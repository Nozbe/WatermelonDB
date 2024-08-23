/*
 * Copyright (C) 2011 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// modified from original source see README at the top level of this project
/*
** Modified to support SQLite extensions by the SQLite developers: 
** sqlite-dev@sqlite.org.
*/

package io.requery.android.database.sqlite;

import android.annotation.SuppressLint;
import android.database.sqlite.SQLiteException;
import android.os.SystemClock;
import android.util.Log;
import android.util.Printer;
import androidx.core.os.CancellationSignal;
import androidx.core.os.OperationCanceledException;

import java.io.Closeable;
import java.util.ArrayList;
import java.util.Map;
import java.util.WeakHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.locks.LockSupport;

/**
 * Maintains a pool of active SQLite database connections.
 * <p>
 * At any given time, a connection is either owned by the pool, or it has been
 * acquired by a {@link SQLiteSession}.  When the {@link SQLiteSession} is
 * finished with the connection it is using, it must return the connection
 * back to the pool.
 * </p><p>
 * The pool holds strong references to the connections it owns.  However,
 * it only holds <em>weak references</em> to the connections that sessions
 * have acquired from it.  Using weak references in the latter case ensures
 * that the connection pool can detect when connections have been improperly
 * abandoned so that it can create new connections to replace them if needed.
 * </p><p>
 * The connection pool is thread-safe (but the connections themselves are not).
 * </p>
 *
 * <h2>Exception safety</h2>
 * <p>
 * This code attempts to maintain the invariant that opened connections are
 * always owned.  Unfortunately that means it needs to handle exceptions
 * all over to ensure that broken connections get cleaned up.  Most
 * operations invokving SQLite can throw {@link SQLiteException} or other
 * runtime exceptions.  This is a bit of a pain to deal with because the compiler
 * cannot help us catch missing exception handling code.
 * </p><p>
 * The general rule for this file: If we are making calls out to
 * {@link SQLiteConnection} then we must be prepared to handle any
 * runtime exceptions it might throw at us.  Note that out-of-memory
 * is an {@link Error}, not a {@link RuntimeException}.  We don't trouble ourselves
 * handling out of memory because it is hard to do anything at all sensible then
 * and most likely the VM is about to crash.
 * </p>
 *
 * @hide
 */
public final class SQLiteConnectionPool implements Closeable {
    private static final String TAG = "SQLiteConnectionPool";

    // Amount of time to wait in milliseconds before unblocking acquireConnection
    // and logging a message about the connection pool being busy.
    private static final long CONNECTION_POOL_BUSY_MILLIS = 30 * 1000; // 30 seconds

    private final CloseGuard mCloseGuard = CloseGuard.get();

    private final Object mLock = new Object();
    private final AtomicBoolean mConnectionLeaked = new AtomicBoolean();
    private final SQLiteDatabaseConfiguration mConfiguration;
    private int mMaxConnectionPoolSize;
    private boolean mIsOpen;
    private int mNextConnectionId;

    private ConnectionWaiter mConnectionWaiterPool;
    private ConnectionWaiter mConnectionWaiterQueue;

    // Strong references to all available connections.
    private final ArrayList<SQLiteConnection> mAvailableNonPrimaryConnections = new ArrayList<>();
    private SQLiteConnection mAvailablePrimaryConnection;

    // Describes what should happen to an acquired connection when it is returned to the pool.
    enum AcquiredConnectionStatus {
        // The connection should be returned to the pool as usual.
        NORMAL,

        // The connection must be reconfigured before being returned.
        RECONFIGURE,

        // The connection must be closed and discarded.
        DISCARD,
    }

    // Weak references to all acquired connections.  The associated value
    // indicates whether the connection must be reconfigured before being
    // returned to the available connection list or discarded.
    // For example, the prepared statement cache size may have changed and
    // need to be updated in preparation for the next client.
    private final WeakHashMap<SQLiteConnection, AcquiredConnectionStatus> mAcquiredConnections =
            new WeakHashMap<>();

    /**
     * Connection flag: Read-only.
     * <p>
     * This flag indicates that the connection will only be used to
     * perform read-only operations.
     * </p>
     */
    public static final int CONNECTION_FLAG_READ_ONLY = 1;

    /**
     * Connection flag: Primary connection affinity.
     * <p>
     * This flag indicates that the primary connection is required.
     * This flag helps support legacy applications that expect most data modifying
     * operations to be serialized by locking the primary database connection.
     * Setting this flag essentially implements the old "db lock" concept by preventing
     * an operation from being performed until it can obtain exclusive access to
     * the primary connection.
     * </p>
     */
    public static final int CONNECTION_FLAG_PRIMARY_CONNECTION_AFFINITY = 1 << 1;

    /**
     * Connection flag: Connection is being used interactively.
     * <p>
     * This flag indicates that the connection is needed by the UI thread.
     * The connection pool can use this flag to elevate the priority
     * of the database connection request.
     * </p>
     */
    public static final int CONNECTION_FLAG_INTERACTIVE = 1 << 2;

    private SQLiteConnectionPool(SQLiteDatabaseConfiguration configuration) {
        mConfiguration = new SQLiteDatabaseConfiguration(configuration);
        setMaxConnectionPoolSizeLocked();
    }

    @SuppressWarnings("ThrowFromFinallyBlock")
    @Override
    protected void finalize() throws Throwable {
        try {
            dispose(true);
        } finally {
            super.finalize();
        }
    }

    /**
     * Opens a connection pool for the specified database.
     *
     * @param configuration The database configuration.
     * @return The connection pool.
     *
     * @throws SQLiteException if a database error occurs.
     */
    public static SQLiteConnectionPool open(SQLiteDatabaseConfiguration configuration) {
        if (configuration == null) {
            throw new IllegalArgumentException("configuration must not be null.");
        }

        // Create the pool.
        SQLiteConnectionPool pool = new SQLiteConnectionPool(configuration);
        pool.open(); // might throw
        return pool;
    }

    // Might throw
    private void open() {
        // Open the primary connection.
        // This might throw if the database is corrupt.
        mAvailablePrimaryConnection = openConnectionLocked(mConfiguration,
                true /*primaryConnection*/); // might throw

        // Mark the pool as being open for business.
        mIsOpen = true;
        mCloseGuard.open("close");
    }

    /**
     * Closes the connection pool.
     * <p>
     * When the connection pool is closed, it will refuse all further requests
     * to acquire connections.  All connections that are currently available in
     * the pool are closed immediately.  Any connections that are still in use
     * will be closed as soon as they are returned to the pool.
     * </p>
     *
     * @throws IllegalStateException if the pool has been closed.
     */
    public void close() {
        dispose(false);
    }

    private void dispose(boolean finalized) {
        if (mCloseGuard != null) {
            if (finalized) {
                mCloseGuard.warnIfOpen();
            }
            mCloseGuard.close();
        }

        if (!finalized) {
            // Close all connections.  We don't need (or want) to do this
            // when finalized because we don't know what state the connections
            // themselves will be in.  The finalizer is really just here for CloseGuard.
            // The connections will take care of themselves when their own finalizers run.
            synchronized (mLock) {
                throwIfClosedLocked();

                mIsOpen = false;

                closeAvailableConnectionsAndLogExceptionsLocked();

                final int pendingCount = mAcquiredConnections.size();
                if (pendingCount != 0) {
                    Log.i(TAG, "The connection pool for " + mConfiguration.label
                            + " has been closed but there are still "
                            + pendingCount + " connections in use.  They will be closed "
                            + "as they are released back to the pool.");
                }

                wakeConnectionWaitersLocked();
            }
        }
    }

    /**
     * Reconfigures the database configuration of the connection pool and all of its
     * connections.
     * <p>
     * Configuration changes are propagated down to connections immediately if
     * they are available or as soon as they are released.  This includes changes
     * that affect the size of the pool.
     * </p>
     *
     * @param configuration The new configuration.
     *
     * @throws IllegalStateException if the pool has been closed.
     */
    @SuppressLint("Assert")
    public void reconfigure(SQLiteDatabaseConfiguration configuration) {
        if (configuration == null) {
            throw new IllegalArgumentException("configuration must not be null.");
        }

        synchronized (mLock) {
            throwIfClosedLocked();

            boolean walModeChanged = ((configuration.openFlags ^ mConfiguration.openFlags)
                    & SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING) != 0;
            if (walModeChanged) {
                // WAL mode can only be changed if there are no acquired connections
                // because we need to close all but the primary connection first.
                if (!mAcquiredConnections.isEmpty()) {
                    throw new IllegalStateException("Write Ahead Logging (WAL) mode cannot "
                            + "be enabled or disabled while there are transactions in "
                            + "progress.  Finish all transactions and release all active "
                            + "database connections first.");
                }

                // Close all non-primary connections.  This should happen immediately
                // because none of them are in use.
                closeAvailableNonPrimaryConnectionsAndLogExceptionsLocked();
                assert mAvailableNonPrimaryConnections.isEmpty();
            }

            boolean foreignKeyModeChanged = configuration.foreignKeyConstraintsEnabled
                    != mConfiguration.foreignKeyConstraintsEnabled;
            if (foreignKeyModeChanged) {
                // Foreign key constraints can only be changed if there are no transactions
                // in progress.  To make this clear, we throw an exception if there are
                // any acquired connections.
                if (!mAcquiredConnections.isEmpty()) {
                    throw new IllegalStateException("Foreign Key Constraints cannot "
                            + "be enabled or disabled while there are transactions in "
                            + "progress.  Finish all transactions and release all active "
                            + "database connections first.");
                }
            }

            if (mConfiguration.openFlags != configuration.openFlags) {
                // If we are changing open flags and WAL mode at the same time, then
                // we have no choice but to close the primary connection beforehand
                // because there can only be one connection open when we change WAL mode.
                if (walModeChanged) {
                    closeAvailableConnectionsAndLogExceptionsLocked();
                }

                // Try to reopen the primary connection using the new open flags then
                // close and discard all existing connections.
                // This might throw if the database is corrupt or cannot be opened in
                // the new mode in which case existing connections will remain untouched.
                SQLiteConnection newPrimaryConnection = openConnectionLocked(configuration,
                        true /*primaryConnection*/); // might throw

                closeAvailableConnectionsAndLogExceptionsLocked();
                discardAcquiredConnectionsLocked();

                mAvailablePrimaryConnection = newPrimaryConnection;
                mConfiguration.updateParametersFrom(configuration);
                setMaxConnectionPoolSizeLocked();
            } else {
                // Reconfigure the database connections in place.
                mConfiguration.updateParametersFrom(configuration);
                setMaxConnectionPoolSizeLocked();

                closeExcessConnectionsAndLogExceptionsLocked();
                reconfigureAllConnectionsLocked();
            }

            wakeConnectionWaitersLocked();
        }
    }

    /**
     * Acquires a connection from the pool.
     * <p>
     * The caller must call {@link #releaseConnection} to release the connection
     * back to the pool when it is finished.  Failure to do so will result
     * in much unpleasantness.
     * </p>
     *
     * @param sql If not null, try to find a connection that already has
     * the specified SQL statement in its prepared statement cache.
     * @param connectionFlags The connection request flags.
     * @param cancellationSignal A signal to cancel the operation in progress, or null if none.
     * @return The connection that was acquired, never null.
     *
     * @throws IllegalStateException if the pool has been closed.
     * @throws SQLiteException if a database error occurs.
     * @throws OperationCanceledException if the operation was canceled.
     */
    public SQLiteConnection acquireConnection(String sql, int connectionFlags,
            CancellationSignal cancellationSignal) {
        return waitForConnection(sql, connectionFlags, cancellationSignal);
    }

    /**
     * Releases a connection back to the pool.
     * <p>
     * It is ok to call this method after the pool has closed, to release
     * connections that were still in use at the time of closure.
     * </p>
     *
     * @param connection The connection to release.  Must not be null.
     *
     * @throws IllegalStateException if the connection was not acquired
     * from this pool or if it has already been released.
     */
    public void releaseConnection(SQLiteConnection connection) {
        synchronized (mLock) {
            AcquiredConnectionStatus status = mAcquiredConnections.remove(connection);
            if (status == null) {
                throw new IllegalStateException("Cannot perform this operation "
                        + "because the specified connection was not acquired "
                        + "from this pool or has already been released.");
            }

            if (!mIsOpen) {
                closeConnectionAndLogExceptionsLocked(connection);
            } else if (connection.isPrimaryConnection()) {
                if (recycleConnectionLocked(connection, status)) {
                    assert mAvailablePrimaryConnection == null;
                    mAvailablePrimaryConnection = connection;
                }
                wakeConnectionWaitersLocked();
            } else if (mAvailableNonPrimaryConnections.size() >= mMaxConnectionPoolSize - 1) {
                closeConnectionAndLogExceptionsLocked(connection);
            } else {
                if (recycleConnectionLocked(connection, status)) {
                    mAvailableNonPrimaryConnections.add(connection);
                }
                wakeConnectionWaitersLocked();
            }
        }
    }

    // Can't throw.
    private boolean recycleConnectionLocked(SQLiteConnection connection,
            AcquiredConnectionStatus status) {
        if (status == AcquiredConnectionStatus.RECONFIGURE) {
            try {
                connection.reconfigure(mConfiguration); // might throw
            } catch (RuntimeException ex) {
                Log.e(TAG, "Failed to reconfigure released connection, closing it: "
                        + connection, ex);
                status = AcquiredConnectionStatus.DISCARD;
            }
        }
        if (status == AcquiredConnectionStatus.DISCARD) {
            closeConnectionAndLogExceptionsLocked(connection);
            return false;
        }
        return true;
    }

    /**
     * Returns true if the session should yield the connection due to
     * contention over available database connections.
     *
     * @param connection The connection owned by the session.
     * @param connectionFlags The connection request flags.
     * @return True if the session should yield its connection.
     *
     * @throws IllegalStateException if the connection was not acquired
     * from this pool or if it has already been released.
     */
    public boolean shouldYieldConnection(SQLiteConnection connection, int connectionFlags) {
        synchronized (mLock) {
            if (!mAcquiredConnections.containsKey(connection)) {
                throw new IllegalStateException("Cannot perform this operation "
                        + "because the specified connection was not acquired "
                        + "from this pool or has already been released.");
            }

            if (!mIsOpen) {
                return false;
            }

            return isSessionBlockingImportantConnectionWaitersLocked(
                    connection.isPrimaryConnection(), connectionFlags);
        }
    }

    /**
     * Collects statistics about database connection memory usage.
     *
     * @param dbStatsList The list to populate.
     */
    public void collectDbStats(ArrayList<SQLiteDebug.DbStats> dbStatsList) {
        synchronized (mLock) {
            if (mAvailablePrimaryConnection != null) {
                mAvailablePrimaryConnection.collectDbStats(dbStatsList);
            }

            for (SQLiteConnection connection : mAvailableNonPrimaryConnections) {
                connection.collectDbStats(dbStatsList);
            }

            for (SQLiteConnection connection : mAcquiredConnections.keySet()) {
                connection.collectDbStatsUnsafe(dbStatsList);
            }
        }
    }

    // Might throw.
    private SQLiteConnection openConnectionLocked(SQLiteDatabaseConfiguration configuration,
            boolean primaryConnection) {
        final int connectionId = mNextConnectionId++;
        return SQLiteConnection.open(this, configuration,
                connectionId, primaryConnection); // might throw
    }

    void onConnectionLeaked() {
        // This code is running inside of the SQLiteConnection finalizer.
        //
        // We don't know whether it is just the connection that has been finalized (and leaked)
        // or whether the connection pool has also been or is about to be finalized.
        // Consequently, it would be a bad idea to try to grab any locks or to
        // do any significant work here.  So we do the simplest possible thing and
        // set a flag.  waitForConnection() periodically checks this flag (when it
        // times out) so that it can recover from leaked connections and wake
        // itself or other threads up if necessary.
        //
        // You might still wonder why we don't try to do more to wake up the waiters
        // immediately.  First, as explained above, it would be hard to do safely
        // unless we started an extra Thread to function as a reference queue.  Second,
        // this is never supposed to happen in normal operation.  Third, there is no
        // guarantee that the GC will actually detect the leak in a timely manner so
        // it's not all that important that we recover from the leak in a timely manner
        // either.  Fourth, if a badly behaved application finds itself hung waiting for
        // several seconds while waiting for a leaked connection to be detected and recreated,
        // then perhaps its authors will have added incentive to fix the problem!

        Log.w(TAG, "A SQLiteConnection object for database '"
                + mConfiguration.label + "' was leaked!  Please fix your application "
                + "to end transactions in progress properly and to close the database "
                + "when it is no longer needed.");

        mConnectionLeaked.set(true);
    }

    // Can't throw.
    private void closeAvailableConnectionsAndLogExceptionsLocked() {
        closeAvailableNonPrimaryConnectionsAndLogExceptionsLocked();

        if (mAvailablePrimaryConnection != null) {
            closeConnectionAndLogExceptionsLocked(mAvailablePrimaryConnection);
            mAvailablePrimaryConnection = null;
        }
    }

    // Can't throw.
    private void closeAvailableNonPrimaryConnectionsAndLogExceptionsLocked() {
        for (SQLiteConnection connection : mAvailableNonPrimaryConnections) {
            closeConnectionAndLogExceptionsLocked(connection);
        }
        mAvailableNonPrimaryConnections.clear();
    }

    // Can't throw.
    private void closeExcessConnectionsAndLogExceptionsLocked() {
        int availableCount = mAvailableNonPrimaryConnections.size();
        while (availableCount-- > mMaxConnectionPoolSize - 1) {
            SQLiteConnection connection =
                    mAvailableNonPrimaryConnections.remove(availableCount);
            closeConnectionAndLogExceptionsLocked(connection);
        }
    }

    // Can't throw.
    private void closeConnectionAndLogExceptionsLocked(SQLiteConnection connection) {
        try {
            connection.close(); // might throw
        } catch (RuntimeException ex) {
            Log.e(TAG, "Failed to close connection, its fate is now in the hands "
                    + "of the merciful GC: " + connection, ex);
        }
    }

    // Can't throw.
    private void discardAcquiredConnectionsLocked() {
        markAcquiredConnectionsLocked(AcquiredConnectionStatus.DISCARD);
    }

    // Can't throw.
    private void reconfigureAllConnectionsLocked() {
        if (mAvailablePrimaryConnection != null) {
            try {
                mAvailablePrimaryConnection.reconfigure(mConfiguration); // might throw
            } catch (RuntimeException ex) {
                Log.e(TAG, "Failed to reconfigure available primary connection, closing it: "
                        + mAvailablePrimaryConnection, ex);
                closeConnectionAndLogExceptionsLocked(mAvailablePrimaryConnection);
                mAvailablePrimaryConnection = null;
            }
        }

        int count = mAvailableNonPrimaryConnections.size();
        for (int i = 0; i < count; i++) {
            final SQLiteConnection connection = mAvailableNonPrimaryConnections.get(i);
            try {
                connection.reconfigure(mConfiguration); // might throw
            } catch (RuntimeException ex) {
                Log.e(TAG, "Failed to reconfigure available non-primary connection, closing it: "
                        + connection, ex);
                closeConnectionAndLogExceptionsLocked(connection);
                mAvailableNonPrimaryConnections.remove(i--);
                count -= 1;
            }
        }

        markAcquiredConnectionsLocked(AcquiredConnectionStatus.RECONFIGURE);
    }

    // Can't throw.
    private void markAcquiredConnectionsLocked(AcquiredConnectionStatus status) {
        if (!mAcquiredConnections.isEmpty()) {
            ArrayList<SQLiteConnection> keysToUpdate = new ArrayList<>(
                    mAcquiredConnections.size());
            for (Map.Entry<SQLiteConnection, AcquiredConnectionStatus> entry
                    : mAcquiredConnections.entrySet()) {
                AcquiredConnectionStatus oldStatus = entry.getValue();
                if (status != oldStatus
                        && oldStatus != AcquiredConnectionStatus.DISCARD) {
                    keysToUpdate.add(entry.getKey());
                }
            }
            for (SQLiteConnection key : keysToUpdate) {
                mAcquiredConnections.put(key, status);
            }
        }
    }

    // Might throw.
    private SQLiteConnection waitForConnection(String sql, int connectionFlags,
            CancellationSignal cancellationSignal) {
        final boolean wantPrimaryConnection =
                (connectionFlags & CONNECTION_FLAG_PRIMARY_CONNECTION_AFFINITY) != 0;

        final ConnectionWaiter waiter;
        final int nonce;
        synchronized (mLock) {
            throwIfClosedLocked();

            // Abort if canceled.
            if (cancellationSignal != null) {
                cancellationSignal.throwIfCanceled();
            }

            // Try to acquire a connection.
            SQLiteConnection connection = null;
            if (!wantPrimaryConnection) {
                connection = tryAcquireNonPrimaryConnectionLocked(
                        sql, connectionFlags); // might throw
            }
            if (connection == null) {
                connection = tryAcquirePrimaryConnectionLocked(connectionFlags); // might throw
            }
            if (connection != null) {
                return connection;
            }

            // No connections available.  Enqueue a waiter in priority order.
            final int priority = getPriority(connectionFlags);
            final long startTime = SystemClock.uptimeMillis();
            waiter = obtainConnectionWaiterLocked(Thread.currentThread(), startTime,
                    priority, wantPrimaryConnection, sql, connectionFlags);
            ConnectionWaiter predecessor = null;
            ConnectionWaiter successor = mConnectionWaiterQueue;
            while (successor != null) {
                if (priority > successor.mPriority) {
                    waiter.mNext = successor;
                    break;
                }
                predecessor = successor;
                successor = successor.mNext;
            }
            if (predecessor != null) {
                predecessor.mNext = waiter;
            } else {
                mConnectionWaiterQueue = waiter;
            }

            nonce = waiter.mNonce;
        }

        // Set up the cancellation listener.
        if (cancellationSignal != null) {
            cancellationSignal.setOnCancelListener(new CancellationSignal.OnCancelListener() {
                @Override
                public void onCancel() {
                    synchronized (mLock) {
                        if (waiter.mNonce == nonce) {
                            cancelConnectionWaiterLocked(waiter);
                        }
                    }
                }
            });
        }
        try {
            // Park the thread until a connection is assigned or the pool is closed.
            // Rethrow an exception from the wait, if we got one.
            long busyTimeoutMillis = CONNECTION_POOL_BUSY_MILLIS;
            long nextBusyTimeoutTime = waiter.mStartTime + busyTimeoutMillis;
            for (;;) {
                // Detect and recover from connection leaks.
                if (mConnectionLeaked.compareAndSet(true, false)) {
                    synchronized (mLock) {
                        wakeConnectionWaitersLocked();
                    }
                }

                // Wait to be unparked (may already have happened), a timeout, or interruption.
                LockSupport.parkNanos(this, busyTimeoutMillis * 1000000L);

                // Clear the interrupted flag, just in case.
                Thread.interrupted();

                // Check whether we are done waiting yet.
                synchronized (mLock) {
                    throwIfClosedLocked();

                    final SQLiteConnection connection = waiter.mAssignedConnection;
                    final RuntimeException ex = waiter.mException;
                    if (connection != null || ex != null) {
                        recycleConnectionWaiterLocked(waiter);
                        if (connection != null) {
                            return connection;
                        }
                        throw ex; // rethrow!
                    }

                    final long now = SystemClock.uptimeMillis();
                    if (now < nextBusyTimeoutTime) {
                        busyTimeoutMillis = now - nextBusyTimeoutTime;
                    } else {
                        logConnectionPoolBusyLocked(now - waiter.mStartTime, connectionFlags);
                        busyTimeoutMillis = CONNECTION_POOL_BUSY_MILLIS;
                        nextBusyTimeoutTime = now + busyTimeoutMillis;
                    }
                }
            }
        } finally {
            // Remove the cancellation listener.
            if (cancellationSignal != null) {
                cancellationSignal.setOnCancelListener(null);
            }
        }
    }

    // Can't throw.
    private void cancelConnectionWaiterLocked(ConnectionWaiter waiter) {
        if (waiter.mAssignedConnection != null || waiter.mException != null) {
            // Waiter is done waiting but has not woken up yet.
            return;
        }

        // Waiter must still be waiting.  Dequeue it.
        ConnectionWaiter predecessor = null;
        ConnectionWaiter current = mConnectionWaiterQueue;
        while (current != waiter) {
            assert current != null;
            predecessor = current;
            current = current.mNext;
        }
        if (predecessor != null) {
            predecessor.mNext = waiter.mNext;
        } else {
            mConnectionWaiterQueue = waiter.mNext;
        }

        // Send the waiter an exception and unpark it.
        waiter.mException = new OperationCanceledException();
        LockSupport.unpark(waiter.mThread);

        // Check whether removing this waiter will enable other waiters to make progress.
        wakeConnectionWaitersLocked();
    }

    // Can't throw.
    private void logConnectionPoolBusyLocked(long waitMillis, int connectionFlags) {
        final Thread thread = Thread.currentThread();
        StringBuilder msg = new StringBuilder();
        msg.append("The connection pool for database '").append(mConfiguration.label);
        msg.append("' has been unable to grant a connection to thread ");
        msg.append(thread.getId()).append(" (").append(thread.getName()).append(") ");
        msg.append("with flags 0x").append(Integer.toHexString(connectionFlags));
        msg.append(" for ").append(waitMillis * 0.001f).append(" seconds.\n");

        ArrayList<String> requests = new ArrayList<>();
        int activeConnections = 0;
        int idleConnections = 0;
        if (!mAcquiredConnections.isEmpty()) {
            for (SQLiteConnection connection : mAcquiredConnections.keySet()) {
                String description = connection.describeCurrentOperationUnsafe();
                if (description != null) {
                    requests.add(description);
                    activeConnections += 1;
                } else {
                    idleConnections += 1;
                }
            }
        }
        int availableConnections = mAvailableNonPrimaryConnections.size();
        if (mAvailablePrimaryConnection != null) {
            availableConnections += 1;
        }

        msg.append("Connections: ").append(activeConnections).append(" active, ");
        msg.append(idleConnections).append(" idle, ");
        msg.append(availableConnections).append(" available.\n");

        if (!requests.isEmpty()) {
            msg.append("\nRequests in progress:\n");
            for (String request : requests) {
                msg.append("  ").append(request).append("\n");
            }
        }

        Log.w(TAG, msg.toString());
    }

    // Can't throw.
    private void wakeConnectionWaitersLocked() {
        // Unpark all waiters that have requests that we can fulfill.
        // This method is designed to not throw runtime exceptions, although we might send
        // a waiter an exception for it to rethrow.
        ConnectionWaiter predecessor = null;
        ConnectionWaiter waiter = mConnectionWaiterQueue;
        boolean primaryConnectionNotAvailable = false;
        boolean nonPrimaryConnectionNotAvailable = false;
        while (waiter != null) {
            boolean unpark = false;
            if (!mIsOpen) {
                unpark = true;
            } else {
                try {
                    SQLiteConnection connection = null;
                    if (!waiter.mWantPrimaryConnection && !nonPrimaryConnectionNotAvailable) {
                        connection = tryAcquireNonPrimaryConnectionLocked(
                                waiter.mSql, waiter.mConnectionFlags); // might throw
                        if (connection == null) {
                            nonPrimaryConnectionNotAvailable = true;
                        }
                    }
                    if (connection == null && !primaryConnectionNotAvailable) {
                        connection = tryAcquirePrimaryConnectionLocked(
                                waiter.mConnectionFlags); // might throw
                        if (connection == null) {
                            primaryConnectionNotAvailable = true;
                        }
                    }
                    if (connection != null) {
                        waiter.mAssignedConnection = connection;
                        unpark = true;
                    } else if (nonPrimaryConnectionNotAvailable && primaryConnectionNotAvailable) {
                        // There are no connections available and the pool is still open.
                        // We cannot fulfill any more connection requests, so stop here.
                        break;
                    }
                } catch (RuntimeException ex) {
                    // Let the waiter handle the exception from acquiring a connection.
                    waiter.mException = ex;
                    unpark = true;
                }
            }

            final ConnectionWaiter successor = waiter.mNext;
            if (unpark) {
                if (predecessor != null) {
                    predecessor.mNext = successor;
                } else {
                    mConnectionWaiterQueue = successor;
                }
                waiter.mNext = null;

                LockSupport.unpark(waiter.mThread);
            } else {
                predecessor = waiter;
            }
            waiter = successor;
        }
    }

    // Might throw.
    private SQLiteConnection tryAcquirePrimaryConnectionLocked(int connectionFlags) {
        // If the primary connection is available, acquire it now.
        SQLiteConnection connection = mAvailablePrimaryConnection;
        if (connection != null) {
            mAvailablePrimaryConnection = null;
            finishAcquireConnectionLocked(connection, connectionFlags); // might throw
            return connection;
        }

        // Make sure that the primary connection actually exists and has just been acquired.
        for (SQLiteConnection acquiredConnection : mAcquiredConnections.keySet()) {
            if (acquiredConnection.isPrimaryConnection()) {
                return null;
            }
        }

        // Uhoh.  No primary connection!  Either this is the first time we asked
        // for it, or maybe it leaked?
        connection = openConnectionLocked(mConfiguration,
                true /*primaryConnection*/); // might throw
        finishAcquireConnectionLocked(connection, connectionFlags); // might throw
        return connection;
    }

    // Might throw.
    private SQLiteConnection tryAcquireNonPrimaryConnectionLocked(
            String sql, int connectionFlags) {
        // Try to acquire the next connection in the queue.
        SQLiteConnection connection;
        final int availableCount = mAvailableNonPrimaryConnections.size();
        if (availableCount > 1 && sql != null) {
            // If we have a choice, then prefer a connection that has the
            // prepared statement in its cache.
            for (int i = 0; i < availableCount; i++) {
                connection = mAvailableNonPrimaryConnections.get(i);
                if (connection.isPreparedStatementInCache(sql)) {
                    mAvailableNonPrimaryConnections.remove(i);
                    finishAcquireConnectionLocked(connection, connectionFlags); // might throw
                    return connection;
                }
            }
        }
        if (availableCount > 0) {
            // Otherwise, just grab the next one.
            connection = mAvailableNonPrimaryConnections.remove(availableCount - 1);
            finishAcquireConnectionLocked(connection, connectionFlags); // might throw
            return connection;
        }

        // Expand the pool if needed.
        int openConnections = mAcquiredConnections.size();
        if (mAvailablePrimaryConnection != null) {
            openConnections += 1;
        }
        if (openConnections >= mMaxConnectionPoolSize) {
            return null;
        }
        connection = openConnectionLocked(mConfiguration,
                false /*primaryConnection*/); // might throw
        finishAcquireConnectionLocked(connection, connectionFlags); // might throw
        return connection;
    }

    // Might throw.
    private void finishAcquireConnectionLocked(SQLiteConnection connection, int connectionFlags) {
        try {
            final boolean readOnly = (connectionFlags & CONNECTION_FLAG_READ_ONLY) != 0;
            connection.setOnlyAllowReadOnlyOperations(readOnly);

            mAcquiredConnections.put(connection, AcquiredConnectionStatus.NORMAL);
        } catch (RuntimeException ex) {
            Log.e(TAG, "Failed to prepare acquired connection for session, closing it: "
                    + connection +", connectionFlags=" + connectionFlags);
            closeConnectionAndLogExceptionsLocked(connection);
            throw ex; // rethrow!
        }
    }

    private boolean isSessionBlockingImportantConnectionWaitersLocked(
            boolean holdingPrimaryConnection, int connectionFlags) {
        ConnectionWaiter waiter = mConnectionWaiterQueue;
        if (waiter != null) {
            final int priority = getPriority(connectionFlags);
            do {
                // Only worry about blocked connections that have same or lower priority.
                if (priority > waiter.mPriority) {
                    break;
                }

                // If we are holding the primary connection then we are blocking the waiter.
                // Likewise, if we are holding a non-primary connection and the waiter
                // would accept a non-primary connection, then we are blocking the waier.
                if (holdingPrimaryConnection || !waiter.mWantPrimaryConnection) {
                    return true;
                }

                waiter = waiter.mNext;
            } while (waiter != null);
        }
        return false;
    }

    private static int getPriority(int connectionFlags) {
        return (connectionFlags & CONNECTION_FLAG_INTERACTIVE) != 0 ? 1 : 0;
    }

    private void setMaxConnectionPoolSizeLocked() {
        if (!SQLiteDatabase.hasCodec()
            && (mConfiguration.openFlags & SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING) != 0) {
            mMaxConnectionPoolSize = SQLiteGlobal.getWALConnectionPoolSize();
        } else {
            // TODO: We don't actually need to restrict the connection pool size to 1
            // for non-WAL databases.  There might be reasons to use connection pooling
            // with other journal modes.  For now, enabling connection pooling and
            // using WAL are the same thing in the API.
            mMaxConnectionPoolSize = 1;
        }
    }

    private void throwIfClosedLocked() {
        if (!mIsOpen) {
            throw new IllegalStateException("Cannot perform this operation "
                    + "because the connection pool has been closed.");
        }
    }

    private ConnectionWaiter obtainConnectionWaiterLocked(Thread thread, long startTime,
            int priority, boolean wantPrimaryConnection, String sql, int connectionFlags) {
        ConnectionWaiter waiter = mConnectionWaiterPool;
        if (waiter != null) {
            mConnectionWaiterPool = waiter.mNext;
            waiter.mNext = null;
        } else {
            waiter = new ConnectionWaiter();
        }
        waiter.mThread = thread;
        waiter.mStartTime = startTime;
        waiter.mPriority = priority;
        waiter.mWantPrimaryConnection = wantPrimaryConnection;
        waiter.mSql = sql;
        waiter.mConnectionFlags = connectionFlags;
        return waiter;
    }

    private void recycleConnectionWaiterLocked(ConnectionWaiter waiter) {
        waiter.mNext = mConnectionWaiterPool;
        waiter.mThread = null;
        waiter.mSql = null;
        waiter.mAssignedConnection = null;
        waiter.mException = null;
        waiter.mNonce += 1;
        mConnectionWaiterPool = waiter;
    }

    public void enableLocalizedCollators() {
        synchronized (mLock) {
            if (!mAcquiredConnections.isEmpty() || mAvailablePrimaryConnection == null) {
                throw new IllegalStateException(
                    "Cannot enable localized collators while database is in use"
                );
            }
            mAvailablePrimaryConnection.enableLocalizedCollators();
        }
    }

    /**
     * Dumps debugging information about this connection pool.
     *
     * @param printer The printer to receive the dump, not null.
     * @param verbose True to dump more verbose information.
     */
    public void dump(Printer printer, boolean verbose) {
        synchronized (mLock) {
            printer.println("Connection pool for " + mConfiguration.path + ":");
            printer.println("  Open: " + mIsOpen);
            printer.println("  Max connections: " + mMaxConnectionPoolSize);

            printer.println("  Available primary connection:");
            if (mAvailablePrimaryConnection != null) {
                mAvailablePrimaryConnection.dump(printer, verbose);
            } else {
                printer.println("<none>");
            }

            printer.println("  Available non-primary connections:");
            if (!mAvailableNonPrimaryConnections.isEmpty()) {
                for (SQLiteConnection connection : mAvailableNonPrimaryConnections) {
                    connection.dump(printer, verbose);
                }
            } else {
                printer.println("<none>");
            }

            printer.println("  Acquired connections:");
            if (!mAcquiredConnections.isEmpty()) {
                for (Map.Entry<SQLiteConnection, AcquiredConnectionStatus> entry :
                        mAcquiredConnections.entrySet()) {
                    final SQLiteConnection connection = entry.getKey();
                    connection.dumpUnsafe(printer, verbose);
                    printer.println("  Status: " + entry.getValue());
                }
            } else {
                printer.println("<none>");
            }

            printer.println("  Connection waiters:");
            if (mConnectionWaiterQueue != null) {
                int i = 0;
                final long now = SystemClock.uptimeMillis();
                for (ConnectionWaiter waiter = mConnectionWaiterQueue; waiter != null;
                        waiter = waiter.mNext, i++) {
                    printer.println(i + ": waited for "
                            + ((now - waiter.mStartTime) * 0.001f)
                            + " ms - thread=" + waiter.mThread
                            + ", priority=" + waiter.mPriority
                            + ", sql='" + waiter.mSql + "'");
                }
            } else {
                printer.println("<none>");
            }
        }
    }

    @Override
    public String toString() {
        return "SQLiteConnectionPool: " + mConfiguration.path;
    }

    private static final class ConnectionWaiter {
        public ConnectionWaiter mNext;
        public Thread mThread;
        public long mStartTime;
        public int mPriority;
        public boolean mWantPrimaryConnection;
        public String mSql;
        public int mConnectionFlags;
        public SQLiteConnection mAssignedConnection;
        public RuntimeException mException;
        public int mNonce;
    }
}
