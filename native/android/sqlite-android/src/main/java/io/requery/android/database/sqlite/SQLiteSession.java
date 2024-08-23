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
import android.database.sqlite.SQLiteTransactionListener;
import android.os.ParcelFileDescriptor;
import androidx.core.os.CancellationSignal;
import androidx.core.os.OperationCanceledException;
import io.requery.android.database.CursorWindow;

/**
 * Provides a single client the ability to use a database.
 *
 * <h2>About database sessions</h2>
 * <p>
 * Database access is always performed using a session.  The session
 * manages the lifecycle of transactions and database connections.
 * </p><p>
 * Sessions can be used to perform both read-only and read-write operations.
 * There is some advantage to knowing when a session is being used for
 * read-only purposes because the connection pool can optimize the use
 * of the available connections to permit multiple read-only operations
 * to execute in parallel whereas read-write operations may need to be serialized.
 * </p><p>
 * When <em>Write Ahead Logging (WAL)</em> is enabled, the database can
 * execute simultaneous read-only and read-write transactions, provided that
 * at most one read-write transaction is performed at a time.  When WAL is not
 * enabled, read-only transactions can execute in parallel but read-write
 * transactions are mutually exclusive.
 * </p>
 *
 * <h2>Ownership and concurrency guarantees</h2>
 * <p>
 * Session objects are not thread-safe.  In fact, session objects are thread-bound.
 * The {@link SQLiteDatabase} uses a thread-local variable to associate a session
 * with each thread for the use of that thread alone.  Consequently, each thread
 * has its own session object and therefore its own transaction state independent
 * of other threads.
 * </p><p>
 * A thread has at most one session per database.  This constraint ensures that
 * a thread can never use more than one database connection at a time for a
 * given database.  As the number of available database connections is limited,
 * if a single thread tried to acquire multiple connections for the same database
 * at the same time, it might deadlock.  Therefore we allow there to be only
 * one session (so, at most one connection) per thread per database.
 * </p>
 *
 * <h2>Transactions</h2>
 * <p>
 * There are two kinds of transaction: implicit transactions and explicit
 * transactions.
 * </p><p>
 * An implicit transaction is created whenever a database operation is requested
 * and there is no explicit transaction currently in progress.  An implicit transaction
 * only lasts for the duration of the database operation in question and then it
 * is ended.  If the database operation was successful, then its changes are committed.
 * </p><p>
 * An explicit transaction is started by calling {@link #beginTransaction} and
 * specifying the desired transaction mode.  Once an explicit transaction has begun,
 * all subsequent database operations will be performed as part of that transaction.
 * To end an explicit transaction, first call {@link #setTransactionSuccessful} if the
 * transaction was successful, then call {@link #endTransaction}.  If the transaction was
 * marked successful, its changes will be committed, otherwise they will be rolled back.
 * </p><p>
 * Explicit transactions can also be nested.  A nested explicit transaction is
 * started with {@link #beginTransaction}, marked successful with
 * {@link #setTransactionSuccessful}and ended with {@link #endTransaction}.
 * If any nested transaction is not marked successful, then the entire transaction
 * including all of its nested transactions will be rolled back
 * when the outermost transaction is ended.
 * </p><p>
 * To improve concurrency, an explicit transaction can be yielded by calling
 * {@link #yieldTransaction}.  If there is contention for use of the database,
 * then yielding ends the current transaction, commits its changes, releases the
 * database connection for use by another session for a little while, and starts a
 * new transaction with the same properties as the original one.
 * Changes committed by {@link #yieldTransaction} cannot be rolled back.
 * </p><p>
 * When a transaction is started, the client can provide a {@link SQLiteTransactionListener}
 * to listen for notifications of transaction-related events.
 * </p><p>
 * Recommended usage:
 * <code><pre>
 * // First, begin the transaction.
 * session.beginTransaction(SQLiteSession.TRANSACTION_MODE_DEFERRED, 0);
 * try {
 *     // Then do stuff...
 *     session.execute("INSERT INTO ...", null, 0);
 *
 *     // As the very last step before ending the transaction, mark it successful.
 *     session.setTransactionSuccessful();
 * } finally {
 *     // Finally, end the transaction.
 *     // This statement will commit the transaction if it was marked successful or
 *     // roll it back otherwise.
 *     session.endTransaction();
 * }
 * </pre></code>
 * </p>
 *
 * <h2>Database connections</h2>
 * <p>
 * A {@link SQLiteDatabase} can have multiple active sessions at the same
 * time.  Each session acquires and releases connections to the database
 * as needed to perform each requested database transaction.  If all connections
 * are in use, then database transactions on some sessions will block until a
 * connection becomes available.
 * </p><p>
 * The session acquires a single database connection only for the duration
 * of a single (implicit or explicit) database transaction, then releases it.
 * This characteristic allows a small pool of database connections to be shared
 * efficiently by multiple sessions as long as they are not all trying to perform
 * database transactions at the same time.
 * </p>
 *
 * <h2>Responsiveness</h2>
 * <p>
 * Because there are a limited number of database connections and the session holds
 * a database connection for the entire duration of a database transaction,
 * it is important to keep transactions short.  This is especially important
 * for read-write transactions since they may block other transactions
 * from executing.  Consider calling {@link #yieldTransaction} periodically
 * during long-running transactions.
 * </p><p>
 * Another important consideration is that transactions that take too long to
 * run may cause the application UI to become unresponsive.  Even if the transaction
 * is executed in a background thread, the user will get bored and
 * frustrated if the application shows no data for several seconds while
 * a transaction runs.
 * </p><p>
 * Guidelines:
 * <ul>
 * <li>Do not perform database transactions on the UI thread.</li>
 * <li>Keep database transactions as short as possible.</li>
 * <li>Simple queries often run faster than complex queries.</li>
 * <li>Measure the performance of your database transactions.</li>
 * <li>Consider what will happen when the size of the data set grows.
 * A query that works well on 100 rows may struggle with 10,000.</li>
 * </ul>
 *
 * <h2>Reentrance</h2>
 * <p>
 * This class must tolerate reentrant execution of SQLite operations because
 * triggers may call custom SQLite functions that perform additional queries.
 * </p>
 *
 * @hide
 */
@SuppressWarnings({"unused", "JavaDoc"})
@SuppressLint("Assert")
public final class SQLiteSession {
    private final SQLiteConnectionPool mConnectionPool;

    private SQLiteConnection mConnection;
    private int mConnectionFlags;
    private int mConnectionUseCount;
    private Transaction mTransactionPool;
    private Transaction mTransactionStack;

    /**
     * Transaction mode: Deferred.
     * <p>
     * In a deferred transaction, no locks are acquired on the database
     * until the first operation is performed.  If the first operation is
     * read-only, then a <code>SHARED</code> lock is acquired, otherwise
     * a <code>RESERVED</code> lock is acquired.
     * </p><p>
     * While holding a <code>SHARED</code> lock, this session is only allowed to
     * read but other sessions are allowed to read or write.
     * While holding a <code>RESERVED</code> lock, this session is allowed to read
     * or write but other sessions are only allowed to read.
     * </p><p>
     * Because the lock is only acquired when needed in a deferred transaction,
     * it is possible for another session to write to the database first before
     * this session has a chance to do anything.
     * </p><p>
     * Corresponds to the SQLite <code>BEGIN DEFERRED</code> transaction mode.
     * </p>
     */
    public static final int TRANSACTION_MODE_DEFERRED = 0;

    /**
     * Transaction mode: Immediate.
     * <p>
     * When an immediate transaction begins, the session acquires a
     * <code>RESERVED</code> lock.
     * </p><p>
     * While holding a <code>RESERVED</code> lock, this session is allowed to read
     * or write but other sessions are only allowed to read.
     * </p><p>
     * Corresponds to the SQLite <code>BEGIN IMMEDIATE</code> transaction mode.
     * </p>
     */
    public static final int TRANSACTION_MODE_IMMEDIATE = 1;

    /**
     * Transaction mode: Exclusive.
     * <p>
     * When an exclusive transaction begins, the session acquires an
     * <code>EXCLUSIVE</code> lock.
     * </p><p>
     * While holding an <code>EXCLUSIVE</code> lock, this session is allowed to read
     * or write but no other sessions are allowed to access the database.
     * </p><p>
     * Corresponds to the SQLite <code>BEGIN EXCLUSIVE</code> transaction mode.
     * </p>
     */
    public static final int TRANSACTION_MODE_EXCLUSIVE = 2;

    /**
     * Creates a session bound to the specified connection pool.
     *
     * @param connectionPool The connection pool.
     */
    public SQLiteSession(SQLiteConnectionPool connectionPool) {
        if (connectionPool == null) {
            throw new IllegalArgumentException("connectionPool must not be null");
        }

        mConnectionPool = connectionPool;
    }

    /**
     * Returns true if the session has a transaction in progress.
     *
     * @return True if the session has a transaction in progress.
     */
    public boolean hasTransaction() {
        return mTransactionStack != null;
    }

    /**
     * Returns true if the session has a nested transaction in progress.
     *
     * @return True if the session has a nested transaction in progress.
     */
    public boolean hasNestedTransaction() {
        return mTransactionStack != null && mTransactionStack.mParent != null;
    }

    /**
     * Returns true if the session has an active database connection.
     *
     * @return True if the session has an active database connection.
     */
    public boolean hasConnection() {
        return mConnection != null;
    }

    /**
     * Begins a transaction.
     * <p>
     * Transactions may nest.  If the transaction is not in progress,
     * then a database connection is obtained and a new transaction is started.
     * Otherwise, a nested transaction is started.
     * </p><p>
     * Each call to {@link #beginTransaction} must be matched exactly by a call
     * to {@link #endTransaction}.  To mark a transaction as successful,
     * call {@link #setTransactionSuccessful} before calling {@link #endTransaction}.
     * If the transaction is not successful, or if any of its nested
     * transactions were not successful, then the entire transaction will
     * be rolled back when the outermost transaction is ended.
     * </p>
     *
     * @param transactionMode The transaction mode.  One of: {@link #TRANSACTION_MODE_DEFERRED},
     * {@link #TRANSACTION_MODE_IMMEDIATE}, or {@link #TRANSACTION_MODE_EXCLUSIVE}.
     * Ignored when creating a nested transaction.
     * @param transactionListener The transaction listener, or null if none.
     * @param connectionFlags The connection flags to use if a connection must be
     * acquired by this operation.  Refer to {@link SQLiteConnectionPool}.
     * @param cancellationSignal A signal to cancel the operation in progress, or null if none.
     *
     * @throws IllegalStateException if {@link #setTransactionSuccessful} has already been
     * called for the current transaction.
     * @throws SQLiteException if an error occurs.
     * @throws OperationCanceledException if the operation was canceled.
     *
     * @see #setTransactionSuccessful
     * @see #yieldTransaction
     * @see #endTransaction
     */
    public void beginTransaction(int transactionMode,
                                 SQLiteTransactionListener transactionListener,
                                 int connectionFlags,
                                 CancellationSignal cancellationSignal) {
        throwIfTransactionMarkedSuccessful();
        beginTransactionUnchecked(transactionMode, transactionListener, connectionFlags,
                cancellationSignal);
    }

    private void beginTransactionUnchecked(int transactionMode,
            SQLiteTransactionListener transactionListener, int connectionFlags,
            CancellationSignal cancellationSignal) {
        if (cancellationSignal != null) {
            cancellationSignal.throwIfCanceled();
        }

        if (mTransactionStack == null) {
            acquireConnection(null, connectionFlags, cancellationSignal); // might throw
        }
        try {
            // Set up the transaction such that we can back out safely
            // in case we fail part way.
            if (mTransactionStack == null) {
                // Execute SQL might throw a runtime exception.
                switch (transactionMode) {
                    case TRANSACTION_MODE_IMMEDIATE:
                        mConnection.execute("BEGIN IMMEDIATE;", null,
                                cancellationSignal); // might throw
                        break;
                    case TRANSACTION_MODE_EXCLUSIVE:
                        mConnection.execute("BEGIN EXCLUSIVE;", null,
                                cancellationSignal); // might throw
                        break;
                    default:
                        mConnection.execute("BEGIN;", null, cancellationSignal); // might throw
                        break;
                }
            }

            // Listener might throw a runtime exception.
            if (transactionListener != null) {
                try {
                    transactionListener.onBegin(); // might throw
                } catch (RuntimeException ex) {
                    if (mTransactionStack == null) {
                        mConnection.execute("ROLLBACK;", null, cancellationSignal); // might throw
                    }
                    throw ex;
                }
            }

            // Bookkeeping can't throw, except an OOM, which is just too bad...
            Transaction transaction = obtainTransaction(transactionMode, transactionListener);
            transaction.mParent = mTransactionStack;
            mTransactionStack = transaction;
        } finally {
            if (mTransactionStack == null) {
                releaseConnection(); // might throw
            }
        }
    }

    /**
     * Marks the current transaction as having completed successfully.
     * <p>
     * This method can be called at most once between {@link #beginTransaction} and
     * {@link #endTransaction} to indicate that the changes made by the transaction should be
     * committed.  If this method is not called, the changes will be rolled back
     * when the transaction is ended.
     * </p>
     *
     * @throws IllegalStateException if there is no current transaction, or if
     * {@link #setTransactionSuccessful} has already been called for the current transaction.
     *
     * @see #beginTransaction
     * @see #endTransaction
     */
    public void setTransactionSuccessful() {
        throwIfNoTransaction();
        throwIfTransactionMarkedSuccessful();

        mTransactionStack.mMarkedSuccessful = true;
    }

    /**
     * Ends the current transaction and commits or rolls back changes.
     * <p>
     * If this is the outermost transaction (not nested within any other
     * transaction), then the changes are committed if {@link #setTransactionSuccessful}
     * was called or rolled back otherwise.
     * </p><p>
     * This method must be called exactly once for each call to {@link #beginTransaction}.
     * </p>
     *
     * @param cancellationSignal A signal to cancel the operation in progress, or null if none.
     *
     * @throws IllegalStateException if there is no current transaction.
     * @throws SQLiteException if an error occurs.
     * @throws OperationCanceledException if the operation was canceled.
     *
     * @see #beginTransaction
     * @see #setTransactionSuccessful
     * @see #yieldTransaction
     */
    public void endTransaction(CancellationSignal cancellationSignal) {
        throwIfNoTransaction();
        assert mConnection != null;

        endTransactionUnchecked(cancellationSignal, false);
    }

    private void endTransactionUnchecked(CancellationSignal cancellationSignal, boolean yielding) {
        if (cancellationSignal != null) {
            cancellationSignal.throwIfCanceled();
        }

        final Transaction top = mTransactionStack;
        boolean successful = (top.mMarkedSuccessful || yielding) && !top.mChildFailed;

        RuntimeException listenerException = null;
        final SQLiteTransactionListener listener = top.mListener;
        if (listener != null) {
            try {
                if (successful) {
                    listener.onCommit(); // might throw
                } else {
                    listener.onRollback(); // might throw
                }
            } catch (RuntimeException ex) {
                listenerException = ex;
                successful = false;
            }
        }

        mTransactionStack = top.mParent;
        recycleTransaction(top);

        if (mTransactionStack != null) {
            if (!successful) {
                mTransactionStack.mChildFailed = true;
            }
        } else {
            try {
                if (successful) {
                    mConnection.execute("COMMIT;", null, cancellationSignal); // might throw
                } else {
                    mConnection.execute("ROLLBACK;", null, cancellationSignal); // might throw
                }
            } finally {
                releaseConnection(); // might throw
            }
        }

        if (listenerException != null) {
            throw listenerException;
        }
    }

    /**
     * Temporarily ends a transaction to let other threads have use of
     * the database.  Begins a new transaction after a specified delay.
     * <p>
     * If there are other threads waiting to acquire connections,
     * then the current transaction is committed and the database
     * connection is released.  After a short delay, a new transaction
     * is started.
     * </p><p>
     * The transaction is assumed to be successful so far.  Do not call
     * {@link #setTransactionSuccessful()} before calling this method.
     * This method will fail if the transaction has already been marked
     * successful.
     * </p><p>
     * The changes that were committed by a yield cannot be rolled back later.
     * </p><p>
     * Before this method was called, there must already have been
     * a transaction in progress.  When this method returns, there will
     * still be a transaction in progress, either the same one as before
     * or a new one if the transaction was actually yielded.
     * </p><p>
     * This method should not be called when there is a nested transaction
     * in progress because it is not possible to yield a nested transaction.
     * If <code>throwIfNested</code> is true, then attempting to yield
     * a nested transaction will throw {@link IllegalStateException}, otherwise
     * the method will return <code>false</code> in that case.
     * </p><p>
     * If there is no nested transaction in progress but a previous nested
     * transaction failed, then the transaction is not yielded (because it
     * must be rolled back) and this method returns <code>false</code>.
     * </p>
     *
     * @param sleepAfterYieldDelayMillis A delay time to wait after yielding
     * the database connection to allow other threads some time to run.
     * If the value is less than or equal to zero, there will be no additional
     * delay beyond the time it will take to begin a new transaction.
     * @param throwIfUnsafe If true, then instead of returning false when no
     * transaction is in progress, a nested transaction is in progress, or when
     * the transaction has already been marked successful, throws {@link IllegalStateException}.
     * @param cancellationSignal A signal to cancel the operation in progress, or null if none.
     * @return True if the transaction was actually yielded.
     *
     * @throws IllegalStateException if <code>throwIfNested</code> is true and
     * there is no current transaction, there is a nested transaction in progress or
     * if {@link #setTransactionSuccessful} has already been called for the current transaction.
     * @throws SQLiteException if an error occurs.
     * @throws OperationCanceledException if the operation was canceled.
     *
     * @see #beginTransaction
     * @see #endTransaction
     */
    public boolean yieldTransaction(long sleepAfterYieldDelayMillis, boolean throwIfUnsafe,
            CancellationSignal cancellationSignal) {
        if (throwIfUnsafe) {
            throwIfNoTransaction();
            throwIfTransactionMarkedSuccessful();
            throwIfNestedTransaction();
        } else {
            if (mTransactionStack == null || mTransactionStack.mMarkedSuccessful
                    || mTransactionStack.mParent != null) {
                return false;
            }
        }
        assert mConnection != null;

        if (mTransactionStack.mChildFailed) {
            return false;
        }

        return yieldTransactionUnchecked(sleepAfterYieldDelayMillis,
                cancellationSignal); // might throw
    }

    private boolean yieldTransactionUnchecked(long sleepAfterYieldDelayMillis,
            CancellationSignal cancellationSignal) {
        if (cancellationSignal != null) {
            cancellationSignal.throwIfCanceled();
        }

        if (!mConnectionPool.shouldYieldConnection(mConnection, mConnectionFlags)) {
            return false;
        }

        final int transactionMode = mTransactionStack.mMode;
        final SQLiteTransactionListener listener = mTransactionStack.mListener;
        final int connectionFlags = mConnectionFlags;
        endTransactionUnchecked(cancellationSignal, true); // might throw

        if (sleepAfterYieldDelayMillis > 0) {
            try {
                Thread.sleep(sleepAfterYieldDelayMillis);
            } catch (InterruptedException ex) {
                // we have been interrupted, that's all we need to do
            }
        }

        beginTransactionUnchecked(transactionMode, listener, connectionFlags,
                cancellationSignal); // might throw
        return true;
    }

    /**
     * Prepares a statement for execution but does not bind its parameters or execute it.
     * <p>
     * This method can be used to check for syntax errors during compilation
     * prior to execution of the statement.  If the {@code outStatementInfo} argument
     * is not null, the provided {@link SQLiteStatementInfo} object is populated
     * with information about the statement.
     * </p><p>
     * A prepared statement makes no reference to the arguments that may eventually
     * be bound to it, consequently it it possible to cache certain prepared statements
     * such as SELECT or INSERT/UPDATE statements.  If the statement is cacheable,
     * then it will be stored in the cache for later and reused if possible.
     * </p>
     *
     * @param sql The SQL statement to prepare.
     * @param connectionFlags The connection flags to use if a connection must be
     * acquired by this operation.  Refer to {@link SQLiteConnectionPool}.
     * @param cancellationSignal A signal to cancel the operation in progress, or null if none.
     * @param outStatementInfo The {@link SQLiteStatementInfo} object to populate
     * with information about the statement, or null if none.
     *
     * @throws SQLiteException if an error occurs, such as a syntax error.
     * @throws OperationCanceledException if the operation was canceled.
     */
    public void prepare(String sql, int connectionFlags, CancellationSignal cancellationSignal,
            SQLiteStatementInfo outStatementInfo) {
        if (sql == null) {
            throw new IllegalArgumentException("sql must not be null.");
        }

        if (cancellationSignal != null) {
            cancellationSignal.throwIfCanceled();
        }

        acquireConnection(sql, connectionFlags, cancellationSignal); // might throw
        try {
            mConnection.prepare(sql, outStatementInfo); // might throw
        } finally {
            releaseConnection(); // might throw
        }
    }

    /**
     * Executes a statement that does not return a result.
     *
     * @param sql The SQL statement to execute.
     * @param bindArgs The arguments to bind, or null if none.
     * @param connectionFlags The connection flags to use if a connection must be
     * acquired by this operation.  Refer to {@link SQLiteConnectionPool}.
     * @param cancellationSignal A signal to cancel the operation in progress, or null if none.
     *
     * @throws SQLiteException if an error occurs, such as a syntax error
     * or invalid number of bind arguments.
     * @throws OperationCanceledException if the operation was canceled.
     */
    public void execute(String sql, Object[] bindArgs, int connectionFlags,
            CancellationSignal cancellationSignal) {
        if (sql == null) {
            throw new IllegalArgumentException("sql must not be null.");
        }

        if (executeSpecial(sql, bindArgs, connectionFlags, cancellationSignal)) {
            return;
        }

        acquireConnection(sql, connectionFlags, cancellationSignal); // might throw
        try {
            mConnection.execute(sql, bindArgs, cancellationSignal); // might throw
        } finally {
            releaseConnection(); // might throw
        }
    }

    /**
     * Executes a statement that returns a single <code>long</code> result.
     *
     * @param sql The SQL statement to execute.
     * @param bindArgs The arguments to bind, or null if none.
     * @param connectionFlags The connection flags to use if a connection must be
     * acquired by this operation.  Refer to {@link SQLiteConnectionPool}.
     * @param cancellationSignal A signal to cancel the operation in progress, or null if none.
     * @return The value of the first column in the first row of the result set
     * as a <code>long</code>, or zero if none.
     *
     * @throws SQLiteException if an error occurs, such as a syntax error
     * or invalid number of bind arguments.
     * @throws OperationCanceledException if the operation was canceled.
     */
    public long executeForLong(String sql, Object[] bindArgs, int connectionFlags,
            CancellationSignal cancellationSignal) {
        if (sql == null) {
            throw new IllegalArgumentException("sql must not be null.");
        }

        if (executeSpecial(sql, bindArgs, connectionFlags, cancellationSignal)) {
            return 0;
        }

        acquireConnection(sql, connectionFlags, cancellationSignal); // might throw
        try {
            return mConnection.executeForLong(sql, bindArgs, cancellationSignal); // might throw
        } finally {
            releaseConnection(); // might throw
        }
    }

    /**
     * Executes a statement that returns a single {@link String} result.
     *
     * @param sql The SQL statement to execute.
     * @param bindArgs The arguments to bind, or null if none.
     * @param connectionFlags The connection flags to use if a connection must be
     * acquired by this operation.  Refer to {@link SQLiteConnectionPool}.
     * @param cancellationSignal A signal to cancel the operation in progress, or null if none.
     * @return The value of the first column in the first row of the result set
     * as a <code>String</code>, or null if none.
     *
     * @throws SQLiteException if an error occurs, such as a syntax error
     * or invalid number of bind arguments.
     * @throws OperationCanceledException if the operation was canceled.
     */
    public String executeForString(String sql, Object[] bindArgs, int connectionFlags,
            CancellationSignal cancellationSignal) {
        if (sql == null) {
            throw new IllegalArgumentException("sql must not be null.");
        }

        if (executeSpecial(sql, bindArgs, connectionFlags, cancellationSignal)) {
            return null;
        }

        acquireConnection(sql, connectionFlags, cancellationSignal); // might throw
        try {
            return mConnection.executeForString(sql, bindArgs, cancellationSignal); // might throw
        } finally {
            releaseConnection(); // might throw
        }
    }

    /**
     * Executes a statement that returns a single BLOB result as a
     * file descriptor to a shared memory region.
     *
     * @param sql The SQL statement to execute.
     * @param bindArgs The arguments to bind, or null if none.
     * @param connectionFlags The connection flags to use if a connection must be
     * acquired by this operation.  Refer to {@link SQLiteConnectionPool}.
     * @param cancellationSignal A signal to cancel the operation in progress, or null if none.
     * @return The file descriptor for a shared memory region that contains
     * the value of the first column in the first row of the result set as a BLOB,
     * or null if none.
     *
     * @throws SQLiteException if an error occurs, such as a syntax error
     * or invalid number of bind arguments.
     * @throws OperationCanceledException if the operation was canceled.
     */
    public ParcelFileDescriptor executeForBlobFileDescriptor(String sql, Object[] bindArgs,
            int connectionFlags, CancellationSignal cancellationSignal) {
        if (sql == null) {
            throw new IllegalArgumentException("sql must not be null.");
        }

        if (executeSpecial(sql, bindArgs, connectionFlags, cancellationSignal)) {
            return null;
        }

        acquireConnection(sql, connectionFlags, cancellationSignal); // might throw
        try {
            return mConnection.executeForBlobFileDescriptor(sql, bindArgs,
                    cancellationSignal); // might throw
        } finally {
            releaseConnection(); // might throw
        }
    }

    /**
     * Executes a statement that returns a count of the number of rows
     * that were changed.  Use for UPDATE or DELETE SQL statements.
     *
     * @param sql The SQL statement to execute.
     * @param bindArgs The arguments to bind, or null if none.
     * @param connectionFlags The connection flags to use if a connection must be
     * acquired by this operation.  Refer to {@link SQLiteConnectionPool}.
     * @param cancellationSignal A signal to cancel the operation in progress, or null if none.
     * @return The number of rows that were changed.
     *
     * @throws SQLiteException if an error occurs, such as a syntax error
     * or invalid number of bind arguments.
     * @throws OperationCanceledException if the operation was canceled.
     */
    public int executeForChangedRowCount(String sql, Object[] bindArgs, int connectionFlags,
            CancellationSignal cancellationSignal) {
        if (sql == null) {
            throw new IllegalArgumentException("sql must not be null.");
        }

        if (executeSpecial(sql, bindArgs, connectionFlags, cancellationSignal)) {
            return 0;
        }

        acquireConnection(sql, connectionFlags, cancellationSignal); // might throw
        try {
            return mConnection.executeForChangedRowCount(sql, bindArgs,
                    cancellationSignal); // might throw
        } finally {
            releaseConnection(); // might throw
        }
    }

    /**
     * Executes a statement that returns the row id of the last row inserted
     * by the statement.  Use for INSERT SQL statements.
     *
     * @param sql The SQL statement to execute.
     * @param bindArgs The arguments to bind, or null if none.
     * @param connectionFlags The connection flags to use if a connection must be
     * acquired by this operation.  Refer to {@link SQLiteConnectionPool}.
     * @param cancellationSignal A signal to cancel the operation in progress, or null if none.
     * @return The row id of the last row that was inserted, or 0 if none.
     *
     * @throws SQLiteException if an error occurs, such as a syntax error
     * or invalid number of bind arguments.
     * @throws OperationCanceledException if the operation was canceled.
     */
    public long executeForLastInsertedRowId(String sql, Object[] bindArgs, int connectionFlags,
            CancellationSignal cancellationSignal) {
        if (sql == null) {
            throw new IllegalArgumentException("sql must not be null.");
        }

        if (executeSpecial(sql, bindArgs, connectionFlags, cancellationSignal)) {
            return 0;
        }

        acquireConnection(sql, connectionFlags, cancellationSignal); // might throw
        try {
            return mConnection.executeForLastInsertedRowId(sql, bindArgs,
                    cancellationSignal); // might throw
        } finally {
            releaseConnection(); // might throw
        }
    }

    /**
     * Executes a statement and populates the specified {@link CursorWindow}
     * with a range of results.  Returns the number of rows that were counted
     * during query execution.
     *
     * @param sql The SQL statement to execute.
     * @param bindArgs The arguments to bind, or null if none.
     * @param window The cursor window to clear and fill.
     * @param startPos The start position for filling the window.
     * @param requiredPos The position of a row that MUST be in the window.
     * If it won't fit, then the query should discard part of what it filled
     * so that it does.  Must be greater than or equal to <code>startPos</code>.
     * @param countAllRows True to count all rows that the query would return
     * regagless of whether they fit in the window.
     * @param connectionFlags The connection flags to use if a connection must be
     * acquired by this operation.  Refer to {@link SQLiteConnectionPool}.
     * @param cancellationSignal A signal to cancel the operation in progress, or null if none.
     * @return The number of rows that were counted during query execution.  Might
     * not be all rows in the result set unless <code>countAllRows</code> is true.
     *
     * @throws SQLiteException if an error occurs, such as a syntax error
     * or invalid number of bind arguments.
     * @throws OperationCanceledException if the operation was canceled.
     */
    public int executeForCursorWindow(String sql, Object[] bindArgs,
                                      CursorWindow window, int startPos, int requiredPos,
                                      boolean countAllRows,
                                      int connectionFlags,
                                      CancellationSignal cancellationSignal) {
        if (sql == null) {
            throw new IllegalArgumentException("sql must not be null.");
        }
        if (window == null) {
            throw new IllegalArgumentException("window must not be null.");
        }

        if (executeSpecial(sql, bindArgs, connectionFlags, cancellationSignal)) {
            window.clear();
            return 0;
        }

        acquireConnection(sql, connectionFlags, cancellationSignal); // might throw
        try {
            return mConnection.executeForCursorWindow(sql, bindArgs,
                    window, startPos, requiredPos, countAllRows,
                    cancellationSignal); // might throw
        } finally {
            releaseConnection(); // might throw
        }
    }

    /**
     * Performs special reinterpretation of certain SQL statements such as "BEGIN",
     * "COMMIT" and "ROLLBACK" to ensure that transaction state invariants are
     * maintained.
     *
     * This function is mainly used to support legacy apps that perform their
     * own transactions by executing raw SQL rather than calling {@link #beginTransaction}
     * and the like.
     *
     * @param sql The SQL statement to execute.
     * @param bindArgs The arguments to bind, or null if none.
     * @param connectionFlags The connection flags to use if a connection must be
     * acquired by this operation.  Refer to {@link SQLiteConnectionPool}.
     * @param cancellationSignal A signal to cancel the operation in progress, or null if none.
     * @return True if the statement was of a special form that was handled here,
     * false otherwise.
     *
     * @throws SQLiteException if an error occurs, such as a syntax error
     * or invalid number of bind arguments.
     * @throws OperationCanceledException if the operation was canceled.
     */
    private boolean executeSpecial(String sql, Object[] bindArgs, int connectionFlags,
            CancellationSignal cancellationSignal) {
        if (cancellationSignal != null) {
            cancellationSignal.throwIfCanceled();
        }

        final int type = SQLiteStatementType.getSqlStatementType(sql);
        switch (type) {
            case SQLiteStatementType.STATEMENT_BEGIN:
                beginTransaction(TRANSACTION_MODE_EXCLUSIVE, null, connectionFlags,
                        cancellationSignal);
                return true;

            case SQLiteStatementType.STATEMENT_COMMIT:
                setTransactionSuccessful();
                endTransaction(cancellationSignal);
                return true;

            case SQLiteStatementType.STATEMENT_ABORT:
                endTransaction(cancellationSignal);
                return true;
        }
        return false;
    }

    private void acquireConnection(String sql, int connectionFlags,
            CancellationSignal cancellationSignal) {
        if (mConnection == null) {
            assert mConnectionUseCount == 0;
            mConnection = mConnectionPool.acquireConnection(sql, connectionFlags,
                    cancellationSignal); // might throw
            mConnectionFlags = connectionFlags;
        }
        mConnectionUseCount += 1;
    }

    private void releaseConnection() {
        assert mConnection != null;
        assert mConnectionUseCount > 0;
        if (--mConnectionUseCount == 0) {
            try {
                mConnectionPool.releaseConnection(mConnection); // might throw
            } finally {
                mConnection = null;
            }
        }
    }

    private void throwIfNoTransaction() {
        if (mTransactionStack == null) {
            throw new IllegalStateException("Cannot perform this operation because "
                    + "there is no current transaction.");
        }
    }

    private void throwIfTransactionMarkedSuccessful() {
        if (mTransactionStack != null && mTransactionStack.mMarkedSuccessful) {
            throw new IllegalStateException("Cannot perform this operation because "
                    + "the transaction has already been marked successful.  The only "
                    + "thing you can do now is call endTransaction().");
        }
    }

    private void throwIfNestedTransaction() {
        if (hasNestedTransaction()) {
            throw new IllegalStateException("Cannot perform this operation because "
                    + "a nested transaction is in progress.");
        }
    }

    private Transaction obtainTransaction(int mode, SQLiteTransactionListener listener) {
        Transaction transaction = mTransactionPool;
        if (transaction != null) {
            mTransactionPool = transaction.mParent;
            transaction.mParent = null;
            transaction.mMarkedSuccessful = false;
            transaction.mChildFailed = false;
        } else {
            transaction = new Transaction();
        }
        transaction.mMode = mode;
        transaction.mListener = listener;
        return transaction;
    }

    private void recycleTransaction(Transaction transaction) {
        transaction.mParent = mTransactionPool;
        transaction.mListener = null;
        mTransactionPool = transaction;
    }

    private static final class Transaction {
        public Transaction mParent;
        public int mMode;
        public SQLiteTransactionListener mListener;
        public boolean mMarkedSuccessful;
        public boolean mChildFailed;
    }
}
