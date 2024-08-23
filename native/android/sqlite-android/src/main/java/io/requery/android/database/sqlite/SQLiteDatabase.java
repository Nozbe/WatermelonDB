/*
 * Copyright (C) 2006 The Android Open Source Project
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
import android.content.ContentValues;
import android.database.Cursor;
import android.database.SQLException;
import android.database.sqlite.SQLiteDatabaseCorruptException;
import android.database.sqlite.SQLiteException;
import android.database.sqlite.SQLiteTransactionListener;
import android.os.Build;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.text.TextUtils;
import android.util.EventLog;
import android.util.Log;
import android.util.Pair;
import android.util.Printer;
import androidx.annotation.IntDef;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.annotation.RequiresApi;
import androidx.core.os.CancellationSignal;
import androidx.core.os.OperationCanceledException;
import androidx.sqlite.db.SupportSQLiteDatabase;
import androidx.sqlite.db.SupportSQLiteQuery;
import io.requery.android.database.DatabaseErrorHandler;
import io.requery.android.database.DefaultDatabaseErrorHandler;

import java.io.File;
import java.io.FileFilter;
import java.io.IOException;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.WeakHashMap;

/**
 * Exposes methods to manage a SQLite database.
 *
 * <p>
 * SQLiteDatabase has methods to create, delete, execute SQL commands, and
 * perform other common database management tasks.
 * </p><p>
 * See the Notepad sample application in the SDK for an example of creating
 * and managing a database.
 * </p><p>
 * Database names must be unique within an application, not across all applications.
 * </p>
 *
 * <h3>Localized Collation - ORDER BY</h3>
 * <p>
 * In addition to SQLite's default <code>BINARY</code> collator, Android supplies
 * two more, <code>LOCALIZED</code>, which changes with the system's current locale,
 * and <code>UNICODE</code>, which is the Unicode Collation Algorithm and not tailored
 * to the current locale.
 * </p>
 */
@SuppressWarnings({"unused", "JavaDoc", "TryFinallyCanBeTryWithResources"})
@SuppressLint("ShiftFlags") // suppressed for readability with native code
public final class SQLiteDatabase extends SQLiteClosable implements SupportSQLiteDatabase {

    /**
     * Name of the compiled native library.
     */
    public static final String LIBRARY_NAME = "sqlite3x";
    static {
        System.loadLibrary(LIBRARY_NAME);
    }

    private static final String TAG = "SQLiteDatabase";

    private static final int EVENT_DB_CORRUPT = 75004;

    // Stores reference to all databases opened in the current process.
    // (The referent Object is not used at this time.)
    // INVARIANT: Guarded by sActiveDatabases.
    private static final WeakHashMap<SQLiteDatabase, Object> sActiveDatabases = new WeakHashMap<>();

    // Thread-local for database sessions that belong to this database.
    // Each thread has its own database session.
    // INVARIANT: Immutable.
    private final ThreadLocal<SQLiteSession> mThreadSession = new ThreadLocal<SQLiteSession>() {
        @Override
        protected SQLiteSession initialValue() {
            return createSession();
        }
    };

    // The optional factory to use when creating new Cursors.  May be null.
    // INVARIANT: Immutable.
    private final CursorFactory mCursorFactory;

    // Error handler to be used when SQLite returns corruption errors.
    // INVARIANT: Immutable.
    private final DatabaseErrorHandler mErrorHandler;

    // Shared database state lock.
    // This lock guards all of the shared state of the database, such as its
    // configuration, whether it is open or closed, and so on.  This lock should
    // be held for as little time as possible.
    //
    // The lock MUST NOT be held while attempting to acquire database connections or
    // while executing SQL statements on behalf of the client as it can lead to deadlock.
    //
    // It is ok to hold the lock while reconfiguring the connection pool or dumping
    // statistics because those operations are non-reentrant and do not try to acquire
    // connections that might be held by other threads.
    //
    // Basic rule: grab the lock, access or modify global state, release the lock, then
    // do the required SQL work.
    private final Object mLock = new Object();

    // Warns if the database is finalized without being closed properly.
    // INVARIANT: Guarded by mLock.
    private final CloseGuard mCloseGuardLocked = CloseGuard.get();

    // The database configuration.
    // INVARIANT: Guarded by mLock.
    private final SQLiteDatabaseConfiguration mConfigurationLocked;

    // The connection pool for the database, null when closed.
    // The pool itself is thread-safe, but the reference to it can only be acquired
    // when the lock is held.
    // INVARIANT: Guarded by mLock.
    private SQLiteConnectionPool mConnectionPoolLocked;

    /**
     * When a constraint violation occurs, an immediate ROLLBACK occurs,
     * thus ending the current transaction, and the command aborts with a
     * return code of SQLITE_CONSTRAINT. If no transaction is active
     * (other than the implied transaction that is created on every command)
     * then this algorithm works the same as ABORT.
     */
    public static final int CONFLICT_ROLLBACK = 1;

    /**
     * When a constraint violation occurs,no ROLLBACK is executed
     * so changes from prior commands within the same transaction
     * are preserved. This is the default behavior.
     */
    public static final int CONFLICT_ABORT = 2;

    /**
     * When a constraint violation occurs, the command aborts with a return
     * code SQLITE_CONSTRAINT. But any changes to the database that
     * the command made prior to encountering the constraint violation
     * are preserved and are not backed out.
     */
    public static final int CONFLICT_FAIL = 3;

    /**
     * When a constraint violation occurs, the one row that contains
     * the constraint violation is not inserted or changed.
     * But the command continues executing normally. Other rows before and
     * after the row that contained the constraint violation continue to be
     * inserted or updated normally. No error is returned.
     */
    public static final int CONFLICT_IGNORE = 4;

    /**
     * When a UNIQUE constraint violation occurs, the pre-existing rows that
     * are causing the constraint violation are removed prior to inserting
     * or updating the current row. Thus the insert or update always occurs.
     * The command continues executing normally. No error is returned.
     * If a NOT NULL constraint violation occurs, the NULL value is replaced
     * by the default value for that column. If the column has no default
     * value, then the ABORT algorithm is used. If a CHECK constraint
     * violation occurs then the IGNORE algorithm is used. When this conflict
     * resolution strategy deletes rows in order to satisfy a constraint,
     * it does not invoke delete triggers on those rows.
     * This behavior might change in a future release.
     */
    public static final int CONFLICT_REPLACE = 5;

    /**
     * Use the following when no conflict action is specified.
     */
    public static final int CONFLICT_NONE = 0;

    /** Conflict options integer enumeration definition */
    @IntDef({
        CONFLICT_ABORT,
        CONFLICT_FAIL,
        CONFLICT_IGNORE,
        CONFLICT_NONE,
        CONFLICT_REPLACE,
        CONFLICT_ROLLBACK})
    @Retention(RetentionPolicy.SOURCE)
    public @interface ConflictAlgorithm {
    }

    private static final String[] CONFLICT_VALUES = new String[]
            {"", " OR ROLLBACK ", " OR ABORT ", " OR FAIL ", " OR IGNORE ", " OR REPLACE "};

    /** Open flag to open in the database in read only mode */
    public static final int OPEN_READONLY         = 0x00000001;

    /** Open flag to open in the database in read/write mode */
    public static final int OPEN_READWRITE        = 0x00000002;

    /** Open flag to create the database if it does not exist */
    public static final int OPEN_CREATE           = 0x00000004;

    /** Open flag to support URI filenames */
    public static final int OPEN_URI              = 0x00000040;

    /** Open flag opens the database in multi-thread threading mode */
    public static final int OPEN_NOMUTEX          = 0x00008000;

    /** Open flag opens the database in serialized threading mode */
    public static final int OPEN_FULLMUTEX        = 0x00010000;

    /** Open flag opens the database in shared cache mode */
    public static final int OPEN_SHAREDCACHE      = 0x00020000;

    /** Open flag opens the database in private cache mode */
    public static final int OPEN_PRIVATECACHE     = 0x00040000;

    /** Open flag equivalent to {@link #OPEN_READWRITE} | {@link #OPEN_CREATE} */
    public static final int CREATE_IF_NECESSARY = OPEN_READWRITE | OPEN_CREATE;

    /** Open flag to enable write-ahead logging */ // custom flag remove for sqlite3_open_v2
    public static final int ENABLE_WRITE_AHEAD_LOGGING = 0x20000000;

    /** Integer flag definition for the database open options */
    @SuppressLint("UniqueConstants") // duplicate values provided for compatibility
    @IntDef(flag = true, value = {
        OPEN_READONLY,
        OPEN_READWRITE,
        OPEN_CREATE,
        OPEN_URI,
        OPEN_NOMUTEX,
        OPEN_FULLMUTEX,
        OPEN_SHAREDCACHE,
        OPEN_PRIVATECACHE,
        CREATE_IF_NECESSARY,
        ENABLE_WRITE_AHEAD_LOGGING})
    @Retention(RetentionPolicy.SOURCE)
    public @interface OpenFlags {
    }

    /**
     * Absolute max value that can be set by {@link #setMaxSqlCacheSize(int)}.
     *
     * Each prepared-statement is between 1K - 6K, depending on the complexity of the
     * SQL statement & schema.  A large SQL cache may use a significant amount of memory.
     */
    public static final int MAX_SQL_CACHE_SIZE = 100;

    private SQLiteDatabase(SQLiteDatabaseConfiguration configuration,
                           CursorFactory cursorFactory,
                           DatabaseErrorHandler errorHandler) {
        mCursorFactory = cursorFactory;
        mErrorHandler = errorHandler != null ? errorHandler : new DefaultDatabaseErrorHandler();
        mConfigurationLocked = configuration;
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

    @Override
    protected void onAllReferencesReleased() {
        dispose(false);
    }

    private void dispose(boolean finalized) {
        final SQLiteConnectionPool pool;
        synchronized (mLock) {
            if (mCloseGuardLocked != null) {
                if (finalized) {
                    mCloseGuardLocked.warnIfOpen();
                }
                mCloseGuardLocked.close();
            }

            pool = mConnectionPoolLocked;
            mConnectionPoolLocked = null;
        }

        if (!finalized) {
            synchronized (sActiveDatabases) {
                sActiveDatabases.remove(this);
            }

            if (pool != null) {
                pool.close();
            }
        }
    }

    /**
     * Attempts to release memory that SQLite holds but does not require to
     * operate properly. Typically this memory will come from the page cache.
     *
     * @return the number of bytes actually released
     */
    public static int releaseMemory() {
        return SQLiteGlobal.releaseMemory();
    }

    /**
     * Gets a label to use when describing the database in log messages.
     * @return The label.
     */
    String getLabel() {
        synchronized (mLock) {
            return mConfigurationLocked.label;
        }
    }

    /**
     * Sends a corruption message to the database error handler.
     */
    void onCorruption() {
        EventLog.writeEvent(EVENT_DB_CORRUPT, getLabel());
        mErrorHandler.onCorruption(this);
    }

    /**
     * Gets the {@link SQLiteSession} that belongs to this thread for this database.
     * Once a thread has obtained a session, it will continue to obtain the same
     * session even after the database has been closed (although the session will not
     * be usable).  However, a thread that does not already have a session cannot
     * obtain one after the database has been closed.
     *
     * The idea is that threads that have active connections to the database may still
     * have work to complete even after the call to {@link #close}.  Active database
     * connections are not actually disposed until they are released by the threads
     * that own them.
     *
     * @return The session, never null.
     *
     * @throws IllegalStateException if the thread does not yet have a session and
     * the database is not open.
     */
    SQLiteSession getThreadSession() {
        return mThreadSession.get(); // initialValue() throws if database closed
    }

    SQLiteSession createSession() {
        final SQLiteConnectionPool pool;
        synchronized (mLock) {
            throwIfNotOpenLocked();
            pool = mConnectionPoolLocked;
        }
        return new SQLiteSession(pool);
    }

    /**
     * Gets default connection flags that are appropriate for this thread, taking into
     * account whether the thread is acting on behalf of the UI.
     *
     * @param readOnly True if the connection should be read-only.
     * @return The connection flags.
     */
    int getThreadDefaultConnectionFlags(boolean readOnly) {
        int flags = readOnly ? SQLiteConnectionPool.CONNECTION_FLAG_READ_ONLY :
                SQLiteConnectionPool.CONNECTION_FLAG_PRIMARY_CONNECTION_AFFINITY;
        if (isMainThread()) {
            flags |= SQLiteConnectionPool.CONNECTION_FLAG_INTERACTIVE;
        }
        return flags;
    }

    private static boolean isMainThread() {
        // FIXME: There should be a better way to do this.
        // Would also be nice to have something that would work across Binder calls.
        Looper looper = Looper.myLooper();
        return looper != null && looper == Looper.getMainLooper();
    }

    /**
     * Begins a transaction in EXCLUSIVE mode.
     * <p>
     * Transactions can be nested.
     * When the outer transaction is ended all of
     * the work done in that transaction and all of the nested transactions will be committed or
     * rolled back. The changes will be rolled back if any transaction is ended without being
     * marked as clean (by calling setTransactionSuccessful). Otherwise they will be committed.
     * </p>
     * <p>Here is the standard idiom for transactions:
     *
     * <pre>
     *   db.beginTransaction();
     *   try {
     *     ...
     *     db.setTransactionSuccessful();
     *   } finally {
     *     db.endTransaction();
     *   }
     * </pre>
     */
    @Override
    public void beginTransaction() {
        beginTransaction(null, SQLiteSession.TRANSACTION_MODE_EXCLUSIVE);
    }

    /**
     * Begins a transaction in IMMEDIATE mode. Transactions can be nested. When
     * the outer transaction is ended all of the work done in that transaction
     * and all of the nested transactions will be committed or rolled back. The
     * changes will be rolled back if any transaction is ended without being
     * marked as clean (by calling setTransactionSuccessful). Otherwise they
     * will be committed.
     * <p>
     * Here is the standard idiom for transactions:
     *
     * <pre>
     *   db.beginTransactionNonExclusive();
     *   try {
     *     ...
     *     db.setTransactionSuccessful();
     *   } finally {
     *     db.endTransaction();
     *   }
     * </pre>
     */
    @Override
    public void beginTransactionNonExclusive() {
        beginTransaction(null, SQLiteSession.TRANSACTION_MODE_IMMEDIATE);
    }

    /**
     * Begins a transaction in DEFERRED mode.
     */
    public void beginTransactionDeferred() {
        beginTransaction(null, SQLiteSession.TRANSACTION_MODE_DEFERRED);
    }

    /**
     * Begins a transaction in DEFERRED mode.
     *
     * @param transactionListener listener that should be notified when the transaction begins,
     * commits, or is rolled back, either explicitly or by a call to
     * {@link #yieldIfContendedSafely}.
     */
    public void beginTransactionWithListenerDeferred(
            SQLiteTransactionListener transactionListener) {
        beginTransaction(transactionListener, SQLiteSession.TRANSACTION_MODE_DEFERRED);
    }

    /**
     * Begins a transaction in EXCLUSIVE mode.
     * <p>
     * Transactions can be nested.
     * When the outer transaction is ended all of
     * the work done in that transaction and all of the nested transactions will be committed or
     * rolled back. The changes will be rolled back if any transaction is ended without being
     * marked as clean (by calling setTransactionSuccessful). Otherwise they will be committed.
     * </p>
     * <p>Here is the standard idiom for transactions:
     *
     * <pre>
     *   db.beginTransactionWithListener(listener);
     *   try {
     *     ...
     *     db.setTransactionSuccessful();
     *   } finally {
     *     db.endTransaction();
     *   }
     * </pre>
     *
     * @param transactionListener listener that should be notified when the transaction begins,
     * commits, or is rolled back, either explicitly or by a call to
     * {@link #yieldIfContendedSafely}.
     */
    @Override
    public void beginTransactionWithListener(SQLiteTransactionListener transactionListener) {
        beginTransaction(transactionListener, SQLiteSession.TRANSACTION_MODE_EXCLUSIVE);
    }

    /**
     * Begins a transaction in IMMEDIATE mode. Transactions can be nested. When
     * the outer transaction is ended all of the work done in that transaction
     * and all of the nested transactions will be committed or rolled back. The
     * changes will be rolled back if any transaction is ended without being
     * marked as clean (by calling setTransactionSuccessful). Otherwise they
     * will be committed.
     * <p>
     * Here is the standard idiom for transactions:
     *
     * <pre>
     *   db.beginTransactionWithListenerNonExclusive(listener);
     *   try {
     *     ...
     *     db.setTransactionSuccessful();
     *   } finally {
     *     db.endTransaction();
     *   }
     * </pre>
     *
     * @param transactionListener listener that should be notified when the
     *            transaction begins, commits, or is rolled back, either
     *            explicitly or by a call to {@link #yieldIfContendedSafely}.
     */
    @Override
    public void beginTransactionWithListenerNonExclusive(
            SQLiteTransactionListener transactionListener) {
        beginTransaction(transactionListener, SQLiteSession.TRANSACTION_MODE_IMMEDIATE);
    }

    private void beginTransaction(SQLiteTransactionListener transactionListener, int mode) {
        acquireReference();
        try {
            getThreadSession().beginTransaction(mode, transactionListener,
                    getThreadDefaultConnectionFlags(false /*readOnly*/), null);
        } finally {
            releaseReference();
        }
    }

    /**
     * End a transaction. See beginTransaction for notes about how to use this and when transactions
     * are committed and rolled back.
     */
    @Override
    public void endTransaction() {
        acquireReference();
        try {
            getThreadSession().endTransaction(null);
        } finally {
            releaseReference();
        }
    }

    /**
     * Marks the current transaction as successful. Do not do any more database work between
     * calling this and calling endTransaction. Do as little non-database work as possible in that
     * situation too. If any errors are encountered between this and endTransaction the transaction
     * will still be committed.
     *
     * @throws IllegalStateException if the current thread is not in a transaction or the
     * transaction is already marked as successful.
     */
    @Override
    public void setTransactionSuccessful() {
        acquireReference();
        try {
            getThreadSession().setTransactionSuccessful();
        } finally {
            releaseReference();
        }
    }

    /**
     * Returns true if the current thread has a transaction pending.
     *
     * @return True if the current thread is in a transaction.
     */
    @Override
    public boolean inTransaction() {
        acquireReference();
        try {
            return getThreadSession().hasTransaction();
        } finally {
            releaseReference();
        }
    }

    /**
     * Returns true if the current thread is holding an active connection to the database.
     * <p>
     * The name of this method comes from a time when having an active connection
     * to the database meant that the thread was holding an actual lock on the
     * database.  Nowadays, there is no longer a true "database lock" although threads
     * may block if they cannot acquire a database connection to perform a
     * particular operation.
     * </p>
     *
     * @return True if the current thread is holding an active connection to the database.
     */
    @Override
    public boolean isDbLockedByCurrentThread() {
        acquireReference();
        try {
            return getThreadSession().hasConnection();
        } finally {
            releaseReference();
        }
    }

    /**
     * Temporarily end the transaction to let other threads run. The transaction is assumed to be
     * successful so far. Do not call setTransactionSuccessful before calling this. When this
     * returns a new transaction will have been created but not marked as successful. This assumes
     * that there are no nested transactions (beginTransaction has only been called once) and will
     * throw an exception if that is not the case.
     * @return true if the transaction was yielded
     */
    @Override
    public boolean yieldIfContendedSafely() {
        return yieldIfContendedHelper(true /* check yielding */, -1 /* sleepAfterYieldDelay*/);
    }

    /**
     * Temporarily end the transaction to let other threads run. The transaction is assumed to be
     * successful so far. Do not call setTransactionSuccessful before calling this. When this
     * returns a new transaction will have been created but not marked as successful. This assumes
     * that there are no nested transactions (beginTransaction has only been called once) and will
     * throw an exception if that is not the case.
     * @param sleepAfterYieldDelay if > 0, sleep this long before starting a new transaction if
     *   the lock was actually yielded. This will allow other background threads to make some
     *   more progress than they would if we started the transaction immediately.
     * @return true if the transaction was yielded
     */
    @Override
    public boolean yieldIfContendedSafely(long sleepAfterYieldDelay) {
        return yieldIfContendedHelper(true /* check yielding */, sleepAfterYieldDelay);
    }

    private boolean yieldIfContendedHelper(boolean throwIfUnsafe, long sleepAfterYieldDelay) {
        acquireReference();
        try {
            return getThreadSession().yieldTransaction(sleepAfterYieldDelay, throwIfUnsafe, null);
        } finally {
            releaseReference();
        }
    }

    /**
     * Open the database according to the flags {@link OpenFlags}
     *
     * <p>Sets the locale of the database to the  the system's current locale.
     * Call {@link #setLocale} if you would like something else.</p>
     *
     * @param path to database file to open and/or create
     * @param factory an optional factory class that is called to instantiate a
     *            cursor when query is called, or null for default
     * @param flags to control database access mode
     * @return the newly opened database
     * @throws SQLiteException if the database cannot be opened
     */
    public static SQLiteDatabase openDatabase(String path,
                                              CursorFactory factory,
                                              @OpenFlags int flags) {
        return openDatabase(path, factory, flags, null);
    }

    /**
     * Open the database according to the flags {@link OpenFlags}
     *
     * <p>Sets the locale of the database to the  the system's current locale.
     * Call {@link #setLocale} if you would like something else.</p>
     *
     * <p>Accepts input param: a concrete instance of {@link DatabaseErrorHandler} to be
     * used to handle corruption when sqlite reports database corruption.</p>
     *
     * @param path to database file to open and/or create
     * @param factory an optional factory class that is called to instantiate a
     *            cursor when query is called, or null for default
     * @param flags to control database access mode
     * @param errorHandler the {@link DatabaseErrorHandler} obj to be used to handle corruption
     * when sqlite reports database corruption
     * @return the newly opened database
     * @throws SQLiteException if the database cannot be opened
     */
    public static SQLiteDatabase openDatabase(String path,
                                              CursorFactory factory,
                                              @OpenFlags int flags,
                                              DatabaseErrorHandler errorHandler) {
        SQLiteDatabaseConfiguration configuration = new SQLiteDatabaseConfiguration(path, flags);
        SQLiteDatabase db = new SQLiteDatabase(configuration, factory, errorHandler);
        db.open();
        return db;
    }

    /**
     * Open the database according to the given configuration.
     *
     * <p>Sets the locale of the database to the  the system's current locale.
     * Call {@link #setLocale} if you would like something else.</p>
     *
     * <p>Accepts input param: a concrete instance of {@link DatabaseErrorHandler} to be
     * used to handle corruption when sqlite reports database corruption.</p>
     *
     * @param configuration to database configuration to use
     * @param factory an optional factory class that is called to instantiate a
     *            cursor when query is called, or null for default
     * @param errorHandler the {@link DatabaseErrorHandler} obj to be used to handle corruption
     * when sqlite reports database corruption
     * @return the newly opened database
     * @throws SQLiteException if the database cannot be opened
     */
    public static SQLiteDatabase openDatabase(SQLiteDatabaseConfiguration configuration,
                                              CursorFactory factory,
                                              DatabaseErrorHandler errorHandler) {
        SQLiteDatabase db = new SQLiteDatabase(configuration, factory, errorHandler);
        db.open();
        return db;
    }

    /**
     * Equivalent to openDatabase(file.getPath(), factory, CREATE_IF_NECESSARY).
     */
    public static SQLiteDatabase openOrCreateDatabase(File file, CursorFactory factory) {
        return openOrCreateDatabase(file.getPath(), factory);
    }

    /**
     * Equivalent to openDatabase(path, factory, CREATE_IF_NECESSARY).
     */
    public static SQLiteDatabase openOrCreateDatabase(String path, CursorFactory factory) {
        return openDatabase(path, factory, CREATE_IF_NECESSARY, null);
    }

    /**
     * Equivalent to openDatabase(path, factory, CREATE_IF_NECESSARY, errorHandler).
     */
    public static SQLiteDatabase openOrCreateDatabase(String path, CursorFactory factory,
            DatabaseErrorHandler errorHandler) {
        return openDatabase(path, factory, CREATE_IF_NECESSARY, errorHandler);
    }

    /**
     * Deletes a database including its journal file and other auxiliary files
     * that may have been created by the database engine.
     *
     * @param file The database file path.
     * @return True if the database was successfully deleted.
     */
    public static boolean deleteDatabase(File file) {
        if (file == null) {
            throw new IllegalArgumentException("file must not be null");
        }

        boolean deleted;
        deleted = file.delete();
        deleted |= new File(file.getPath() + "-journal").delete();
        deleted |= new File(file.getPath() + "-shm").delete();
        deleted |= new File(file.getPath() + "-wal").delete();

        File dir = file.getParentFile();
        if (dir != null) {
            final String prefix = file.getName() + "-mj";
            final FileFilter filter = new FileFilter() {
                @Override
                public boolean accept(File candidate) {
                    return candidate.getName().startsWith(prefix);
                }
            };
            for (File masterJournal : dir.listFiles(filter)) {
                deleted |= masterJournal.delete();
            }
        }
        return deleted;
    }

    /**
     * Reopens the database in read-write mode.
     * If the database is already read-write, does nothing.
     *
     * @throws SQLiteException if the database could not be reopened as requested, in which
     * case it remains open in read only mode.
     * @throws IllegalStateException if the database is not open.
     *
     * @see #isReadOnly()
     * @hide
     */
    public void reopenReadWrite() {
        synchronized (mLock) {
            throwIfNotOpenLocked();

            if (!isReadOnlyLocked()) {
                return; // nothing to do
            }

            // Reopen the database in read-write mode.
            final int oldOpenFlags = mConfigurationLocked.openFlags;
            mConfigurationLocked.openFlags = (mConfigurationLocked.openFlags & ~OPEN_READONLY);
            try {
                mConnectionPoolLocked.reconfigure(mConfigurationLocked);
            } catch (RuntimeException ex) {
                mConfigurationLocked.openFlags = oldOpenFlags;
                throw ex;
            }
        }
    }

    private void open() {
        try {
            if (!mConfigurationLocked.isInMemoryDb()
                    && (mConfigurationLocked.openFlags & OPEN_CREATE) != 0) {
                ensureFile(mConfigurationLocked.path);
            }
            try {
                openInner();
            } catch (SQLiteDatabaseCorruptException ex) {
                onCorruption();
                openInner();
            }
        } catch (SQLiteException ex) {
            Log.e(TAG, "Failed to open database '" + getLabel() + "'.", ex);
            close();
            throw ex;
        }
    }

    private static void ensureFile(String path) {
        File file = new File(path);
        if (!file.exists()) {
            try {
                if (!file.getParentFile().exists() && !file.getParentFile().mkdirs()) {
                    // Fixes #103: Check parent directory's existence before
                    // attempting to create.
                    Log.e(TAG, "Couldn't mkdirs " + file);
                }
                if (!file.createNewFile()) {
                    Log.e(TAG, "Couldn't create " + file);
                }
            } catch (IOException e) {
                Log.e(TAG, "Couldn't ensure file " + file, e);
            }
        }
    }

    private void openInner() {
        synchronized (mLock) {
            assert mConnectionPoolLocked == null;
            mConnectionPoolLocked = SQLiteConnectionPool.open(mConfigurationLocked);
            mCloseGuardLocked.open("close");
        }

        synchronized (sActiveDatabases) {
            sActiveDatabases.put(this, null);
        }
    }

    /**
     * Create a memory backed SQLite database.  Its contents will be destroyed
     * when the database is closed.
     *
     * <p>Sets the locale of the database to the  the system's current locale.
     * Call {@link #setLocale} if you would like something else.</p>
     *
     * @param factory an optional factory class that is called to instantiate a
     *            cursor when query is called
     * @return a SQLiteDatabase object, or null if the database can't be created
     */
    public static SQLiteDatabase create(CursorFactory factory) {
        // This is a magic string with special meaning for SQLite.
        return openDatabase(SQLiteDatabaseConfiguration.MEMORY_DB_PATH,
                factory, CREATE_IF_NECESSARY);
    }

    /**
     * Registers a CustomFunction callback as a function that can be called from
     * SQLite database triggers.
     *
     * @param name the name of the sqlite3 function
     * @param numArgs the number of arguments for the function
     * @param function callback to call when the function is executed
     * @hide
     */
    @Deprecated
    public void addCustomFunction(String name, int numArgs, CustomFunction function) {
        // Create wrapper (also validates arguments).
        SQLiteCustomFunction wrapper = new SQLiteCustomFunction(name, numArgs, function);

        synchronized (mLock) {
            throwIfNotOpenLocked();

            mConfigurationLocked.customFunctions.add(wrapper);
            try {
                mConnectionPoolLocked.reconfigure(mConfigurationLocked);
            } catch (RuntimeException ex) {
                mConfigurationLocked.customFunctions.remove(wrapper);
                throw ex;
            }
        }
    }

    /**
     * Registers a Function callback as a function that can be called from
     * SQLite database triggers.
     *
     * @param name the name of the sqlite3 function
     * @param numArgs the number of arguments for the function
     * @param function callback to call when the function is executed
     * @hide
     */
    public void addFunction(String name, int numArgs, Function function) {
        addFunction(name, numArgs, function, 0);
    }

    /**
     * Registers a Function callback as a function that can be called from
     * SQLite database triggers.
     *
     * @param name the name of the sqlite3 function
     * @param numArgs the number of arguments for the function
     * @param function callback to call when the function is executed
     * @param flags 
     * @hide
     */
    public void addFunction(String name, int numArgs, Function function, int flags) {
        // Create wrapper (also validates arguments).
        SQLiteFunction wrapper = new SQLiteFunction(name, numArgs, function, flags);

        synchronized (mLock) {
            throwIfNotOpenLocked();

            mConfigurationLocked.functions.add(wrapper);
            try {
                mConnectionPoolLocked.reconfigure(mConfigurationLocked);
            } catch (RuntimeException ex) {
                mConfigurationLocked.functions.remove(wrapper);
                throw ex;
            }
        }
    }

    public void setUpdateHook(SQLiteUpdateHook updateHook) {
        synchronized (mLock) {
            throwIfNotOpenLocked();

            mConfigurationLocked.sqliteUpdateHook = updateHook;

            try {
                mConnectionPoolLocked.reconfigure(mConfigurationLocked);
            } catch (RuntimeException ex) {
                mConfigurationLocked.sqliteUpdateHook = null;
                throw ex;
            }
        }
    }

    /**
     * Gets the database version.
     *
     * @return the database version
     */
    @Override
    public int getVersion() {
        return ((Long) longForQuery("PRAGMA user_version;", null)).intValue();
    }

    /**
     * Sets the database version.
     *
     * @param version the new database version
     */
    @Override
    public void setVersion(int version) {
        execSQL("PRAGMA user_version = " + version);
    }

    /**
     * Returns the maximum size the database may grow to.
     *
     * @return the new maximum database size
     */
    @Override
    public long getMaximumSize() {
        long pageCount = longForQuery("PRAGMA max_page_count;", null);
        return pageCount * getPageSize();
    }

    /**
     * Sets the maximum size the database will grow to. The maximum size cannot
     * be set below the current size.
     *
     * @param numBytes the maximum database size, in bytes
     * @return the new maximum database size
     */
    @Override
    public long setMaximumSize(long numBytes) {
        long pageSize = getPageSize();
        long numPages = numBytes / pageSize;
        // If numBytes isn't a multiple of pageSize, bump up a page
        if ((numBytes % pageSize) != 0) {
            numPages++;
        }
        long newPageCount = longForQuery("PRAGMA max_page_count = " + numPages, null);
        return newPageCount * pageSize;
    }

    /**
     * Returns the current database page size, in bytes.
     *
     * @return the database page size, in bytes
     */
    @Override
    public long getPageSize() {
        return longForQuery("PRAGMA page_size;", null);
    }

    /**
     * Sets the database page size. The page size must be a power of two. This
     * method does not work if any data has been written to the database file,
     * and must be called right after the database has been created.
     *
     * @param numBytes the database page size, in bytes
     */
    @Override
    public void setPageSize(long numBytes) {
        execSQL("PRAGMA page_size = " + numBytes);
    }

    /**
     * Finds the name of the first table, which is editable.
     *
     * @param tables a list of tables
     * @return the first table listed
     */
    public static String findEditTable(String tables) {
        if (!TextUtils.isEmpty(tables)) {
            // find the first word terminated by either a space or a comma
            int spacepos = tables.indexOf(' ');
            int commapos = tables.indexOf(',');

            if (spacepos > 0 && (spacepos < commapos || commapos < 0)) {
                return tables.substring(0, spacepos);
            } else if (commapos > 0 && (commapos < spacepos || spacepos < 0) ) {
                return tables.substring(0, commapos);
            }
            return tables;
        } else {
            throw new IllegalStateException("Invalid tables");
        }
    }

    /**
     * Compiles an SQL statement into a reusable pre-compiled statement object.
     * The parameters are identical to {@link #execSQL(String)}. You may put ?s in the
     * statement and fill in those values with {@link SQLiteProgram#bindString}
     * and {@link SQLiteProgram#bindLong} each time you want to run the
     * statement. Statements may not return result sets larger than 1x1.
     *<p>
     * No two threads should be using the same {@link SQLiteStatement} at the same time.
     *
     * @param sql The raw SQL statement, may contain ? for unknown values to be
     *            bound later.
     * @return A pre-compiled {@link SQLiteStatement} object. Note that
     * {@link SQLiteStatement}s are not synchronized, see the documentation for more details.
     */
    @Override
    public SQLiteStatement compileStatement(String sql) throws SQLException {
        acquireReference();
        try {
            return new SQLiteStatement(this, sql, null);
        } finally {
            releaseReference();
        }
    }

    /**
     * Query the given URL, returning a {@link Cursor} over the result set.
     *
     * @param distinct true if you want each row to be unique, false otherwise.
     * @param table The table name to compile the query against.
     * @param columns A list of which columns to return. Passing null will
     *            return all columns, which is discouraged to prevent reading
     *            data from storage that isn't going to be used.
     * @param selection A filter declaring which rows to return, formatted as an
     *            SQL WHERE clause (excluding the WHERE itself). Passing null
     *            will return all rows for the given table.
     * @param selectionArgs You may include ?s in selection, which will be
     *         replaced by the values from selectionArgs, in order that they
     *         appear in the selection.
     * @param groupBy A filter declaring how to group rows, formatted as an SQL
     *            GROUP BY clause (excluding the GROUP BY itself). Passing null
     *            will cause the rows to not be grouped.
     * @param having A filter declare which row groups to include in the cursor,
     *            if row grouping is being used, formatted as an SQL HAVING
     *            clause (excluding the HAVING itself). Passing null will cause
     *            all row groups to be included, and is required when row
     *            grouping is not being used.
     * @param orderBy How to order the rows, formatted as an SQL ORDER BY clause
     *            (excluding the ORDER BY itself). Passing null will use the
     *            default sort order, which may be unordered.
     * @param limit Limits the number of rows returned by the query,
     *            formatted as LIMIT clause. Passing null denotes no LIMIT clause.
     * @return A {@link Cursor} object, which is positioned before the first entry. Note that
     * {@link Cursor}s are not synchronized, see the documentation for more details.
     * @see Cursor
     */
    public Cursor query(boolean distinct, String table, String[] columns,
            String selection, Object[] selectionArgs, String groupBy,
            String having, String orderBy, String limit) {
        return queryWithFactory(null, distinct, table, columns, selection, selectionArgs,
                groupBy, having, orderBy, limit, null);
    }

    /**
     * Query the given URL, returning a {@link Cursor} over the result set.
     *
     * @param distinct true if you want each row to be unique, false otherwise.
     * @param table The table name to compile the query against.
     * @param columns A list of which columns to return. Passing null will
     *            return all columns, which is discouraged to prevent reading
     *            data from storage that isn't going to be used.
     * @param selection A filter declaring which rows to return, formatted as an
     *            SQL WHERE clause (excluding the WHERE itself). Passing null
     *            will return all rows for the given table.
     * @param selectionArgs You may include ?s in selection, which will be
     *         replaced by the values from selectionArgs, in order that they
     *         appear in the selection.
     * @param groupBy A filter declaring how to group rows, formatted as an SQL
     *            GROUP BY clause (excluding the GROUP BY itself). Passing null
     *            will cause the rows to not be grouped.
     * @param having A filter declare which row groups to include in the cursor,
     *            if row grouping is being used, formatted as an SQL HAVING
     *            clause (excluding the HAVING itself). Passing null will cause
     *            all row groups to be included, and is required when row
     *            grouping is not being used.
     * @param orderBy How to order the rows, formatted as an SQL ORDER BY clause
     *            (excluding the ORDER BY itself). Passing null will use the
     *            default sort order, which may be unordered.
     * @param limit Limits the number of rows returned by the query,
     *            formatted as LIMIT clause. Passing null denotes no LIMIT clause.
     * @param cancellationSignal A signal to cancel the operation in progress, or null if none.
     * If the operation is canceled, then {@link OperationCanceledException} will be thrown
     * when the query is executed.
     * @return A {@link Cursor} object, which is positioned before the first entry. Note that
     * {@link Cursor}s are not synchronized, see the documentation for more details.
     * @see Cursor
     */
    public Cursor query(boolean distinct, String table, String[] columns,
            String selection, Object[] selectionArgs, String groupBy,
            String having, String orderBy, String limit, CancellationSignal cancellationSignal) {
        return queryWithFactory(null, distinct, table, columns, selection, selectionArgs,
                groupBy, having, orderBy, limit, cancellationSignal);
    }

    /**
     * Query the given URL, returning a {@link Cursor} over the result set.
     *
     * @param cursorFactory the cursor factory to use, or null for the default factory
     * @param distinct true if you want each row to be unique, false otherwise.
     * @param table The table name to compile the query against.
     * @param columns A list of which columns to return. Passing null will
     *            return all columns, which is discouraged to prevent reading
     *            data from storage that isn't going to be used.
     * @param selection A filter declaring which rows to return, formatted as an
     *            SQL WHERE clause (excluding the WHERE itself). Passing null
     *            will return all rows for the given table.
     * @param selectionArgs You may include ?s in selection, which will be
     *         replaced by the values from selectionArgs, in order that they
     *         appear in the selection.
     * @param groupBy A filter declaring how to group rows, formatted as an SQL
     *            GROUP BY clause (excluding the GROUP BY itself). Passing null
     *            will cause the rows to not be grouped.
     * @param having A filter declare which row groups to include in the cursor,
     *            if row grouping is being used, formatted as an SQL HAVING
     *            clause (excluding the HAVING itself). Passing null will cause
     *            all row groups to be included, and is required when row
     *            grouping is not being used.
     * @param orderBy How to order the rows, formatted as an SQL ORDER BY clause
     *            (excluding the ORDER BY itself). Passing null will use the
     *            default sort order, which may be unordered.
     * @param limit Limits the number of rows returned by the query,
     *            formatted as LIMIT clause. Passing null denotes no LIMIT clause.
     * @return A {@link Cursor} object, which is positioned before the first entry. Note that
     * {@link Cursor}s are not synchronized, see the documentation for more details.
     * @see Cursor
     */
    public Cursor queryWithFactory(CursorFactory cursorFactory,
            boolean distinct, String table, String[] columns,
            String selection, Object[] selectionArgs, String groupBy,
            String having, String orderBy, String limit) {
        return queryWithFactory(cursorFactory, distinct, table, columns, selection,
                selectionArgs, groupBy, having, orderBy, limit, null);
    }

    /**
     * Query the given URL, returning a {@link Cursor} over the result set.
     *
     * @param cursorFactory the cursor factory to use, or null for the default factory
     * @param distinct true if you want each row to be unique, false otherwise.
     * @param table The table name to compile the query against.
     * @param columns A list of which columns to return. Passing null will
     *            return all columns, which is discouraged to prevent reading
     *            data from storage that isn't going to be used.
     * @param selection A filter declaring which rows to return, formatted as an
     *            SQL WHERE clause (excluding the WHERE itself). Passing null
     *            will return all rows for the given table.
     * @param selectionArgs You may include ?s in selection, which will be
     *         replaced by the values from selectionArgs, in order that they
     *         appear in the selection.
     * @param groupBy A filter declaring how to group rows, formatted as an SQL
     *            GROUP BY clause (excluding the GROUP BY itself). Passing null
     *            will cause the rows to not be grouped.
     * @param having A filter declare which row groups to include in the cursor,
     *            if row grouping is being used, formatted as an SQL HAVING
     *            clause (excluding the HAVING itself). Passing null will cause
     *            all row groups to be included, and is required when row
     *            grouping is not being used.
     * @param orderBy How to order the rows, formatted as an SQL ORDER BY clause
     *            (excluding the ORDER BY itself). Passing null will use the
     *            default sort order, which may be unordered.
     * @param limit Limits the number of rows returned by the query,
     *            formatted as LIMIT clause. Passing null denotes no LIMIT clause.
     * @param cancellationSignal A signal to cancel the operation in progress, or null if none.
     * If the operation is canceled, then {@link OperationCanceledException} will be thrown
     * when the query is executed.
     * @return A {@link Cursor} object, which is positioned before the first entry. Note that
     * {@link Cursor}s are not synchronized, see the documentation for more details.
     * @see Cursor
     */
    public Cursor queryWithFactory(CursorFactory cursorFactory,
            boolean distinct, String table, String[] columns,
            String selection, Object[] selectionArgs, String groupBy,
            String having, String orderBy, String limit, CancellationSignal cancellationSignal) {
        acquireReference();
        try {
            String sql = SQLiteQueryBuilder.buildQueryString(
                    distinct, table, columns, selection, groupBy, having, orderBy, limit);

            return rawQueryWithFactory(cursorFactory, sql, selectionArgs,
                    findEditTable(table), cancellationSignal);
        } finally {
            releaseReference();
        }
    }

    /**
     * Query the given table, returning a {@link Cursor} over the result set.
     *
     * @param table The table name to compile the query against.
     * @param columns A list of which columns to return. Passing null will
     *            return all columns, which is discouraged to prevent reading
     *            data from storage that isn't going to be used.
     * @param selection A filter declaring which rows to return, formatted as an
     *            SQL WHERE clause (excluding the WHERE itself). Passing null
     *            will return all rows for the given table.
     * @param selectionArgs You may include ?s in selection, which will be
     *         replaced by the values from selectionArgs, in order that they
     *         appear in the selection.
     * @param groupBy A filter declaring how to group rows, formatted as an SQL
     *            GROUP BY clause (excluding the GROUP BY itself). Passing null
     *            will cause the rows to not be grouped.
     * @param having A filter declare which row groups to include in the cursor,
     *            if row grouping is being used, formatted as an SQL HAVING
     *            clause (excluding the HAVING itself). Passing null will cause
     *            all row groups to be included, and is required when row
     *            grouping is not being used.
     * @param orderBy How to order the rows, formatted as an SQL ORDER BY clause
     *            (excluding the ORDER BY itself). Passing null will use the
     *            default sort order, which may be unordered.
     * @return A {@link Cursor} object, which is positioned before the first entry. Note that
     * {@link Cursor}s are not synchronized, see the documentation for more details.
     * @see Cursor
     */
    public Cursor query(String table, String[] columns, String selection,
            Object[] selectionArgs, String groupBy, String having,
            String orderBy) {

        return query(false, table, columns, selection, selectionArgs, groupBy,
                having, orderBy, null /* limit */);
    }

    /**
     * Query the given table, returning a {@link Cursor} over the result set.
     *
     * @param table The table name to compile the query against.
     * @param columns A list of which columns to return. Passing null will
     *            return all columns, which is discouraged to prevent reading
     *            data from storage that isn't going to be used.
     * @param selection A filter declaring which rows to return, formatted as an
     *            SQL WHERE clause (excluding the WHERE itself). Passing null
     *            will return all rows for the given table.
     * @param selectionArgs You may include ?s in selection, which will be
     *         replaced by the values from selectionArgs, in order that they
     *         appear in the selection.
     * @param groupBy A filter declaring how to group rows, formatted as an SQL
     *            GROUP BY clause (excluding the GROUP BY itself). Passing null
     *            will cause the rows to not be grouped.
     * @param having A filter declare which row groups to include in the cursor,
     *            if row grouping is being used, formatted as an SQL HAVING
     *            clause (excluding the HAVING itself). Passing null will cause
     *            all row groups to be included, and is required when row
     *            grouping is not being used.
     * @param orderBy How to order the rows, formatted as an SQL ORDER BY clause
     *            (excluding the ORDER BY itself). Passing null will use the
     *            default sort order, which may be unordered.
     * @param limit Limits the number of rows returned by the query,
     *            formatted as LIMIT clause. Passing null denotes no LIMIT clause.
     * @return A {@link Cursor} object, which is positioned before the first entry. Note that
     * {@link Cursor}s are not synchronized, see the documentation for more details.
     * @see Cursor
     */
    public Cursor query(String table, String[] columns, String selection,
            Object[] selectionArgs, String groupBy, String having,
            String orderBy, String limit) {

        return query(false, table, columns, selection, selectionArgs, groupBy,
                having, orderBy, limit);
    }

    /**
     * Runs the provided SQL and returns a {@link Cursor} over the result set.
     *
     * @param query the SQL query. The SQL string must not be ; terminated
     * @return A {@link Cursor} object, which is positioned before the first entry. Note that
     * {@link Cursor}s are not synchronized, see the documentation for more details.
     */
    @Override
    public Cursor query(String query) {
        return rawQueryWithFactory(null, query, null, null, null);
    }

    /**
     * Runs the provided SQL and returns a {@link Cursor} over the result set.
     *
     * @param query the SQL query. The SQL string must not be ; terminated
     * @param selectionArgs You may include ?s in where clause in the query,
     *     which will be replaced by the values from selectionArgs.
     * @return A {@link Cursor} object, which is positioned before the first entry. Note that
     * {@link Cursor}s are not synchronized, see the documentation for more details.
     */
    @Override
    public Cursor query(String query, Object[] selectionArgs) {
        return rawQueryWithFactory(null, query, selectionArgs, null, null);
    }

    /**
     * Runs the provided SQL and returns a {@link Cursor} over the result set.
     *
     * @param supportQuery the SQL query.
     * @return A {@link Cursor} object, which is positioned before the first entry. Note that
     * {@link Cursor}s are not synchronized, see the documentation for more details.
     */
    @Override
    public Cursor query(final SupportSQLiteQuery supportQuery) {
        return query(supportQuery, (CancellationSignal) null);
    }

    /**
     * Runs the provided SQL and returns a {@link Cursor} over the result set.
     *
     * @param supportQuery the SQL query. The SQL string must not be ; terminated
     * @param signal A signal to cancel the operation in progress, or null if none.
     * If the operation is canceled, then {@link OperationCanceledException} will be thrown
     * when the query is executed.
     * @return A {@link Cursor} object, which is positioned before the first entry. Note that
     * {@link Cursor}s are not synchronized, see the documentation for more details.
     */
    @Override
    @RequiresApi(api = Build.VERSION_CODES.JELLY_BEAN)
    public Cursor query(SupportSQLiteQuery supportQuery, android.os.CancellationSignal signal) {
        if (signal != null) {
            final CancellationSignal supportCancellationSignal = new CancellationSignal();
            signal.setOnCancelListener(new android.os.CancellationSignal.OnCancelListener() {
                @Override
                public void onCancel() {
                    supportCancellationSignal.cancel();
                }
            });
            return query(supportQuery, supportCancellationSignal);
        } else {
            return query(supportQuery, (CancellationSignal) null);
        }
    }

    /**
     * Runs the provided SQL and returns a {@link Cursor} over the result set.
     *
     * @param supportQuery the SQL query. The SQL string must not be ; terminated
     * @param signal A signal to cancel the operation in progress, or null if none.
     * If the operation is canceled, then {@link OperationCanceledException} will be thrown
     * when the query is executed.
     * @return A {@link Cursor} object, which is positioned before the first entry. Note that
     * {@link Cursor}s are not synchronized, see the documentation for more details.
     */
    public Cursor query(final SupportSQLiteQuery supportQuery, CancellationSignal signal) {
        return rawQueryWithFactory(new CursorFactory() {
            @Override
            public Cursor newCursor(SQLiteDatabase db, SQLiteCursorDriver masterQuery,
                                    String editTable, SQLiteQuery query) {
                supportQuery.bindTo(query);
                if (mCursorFactory == null) {
                    return new SQLiteCursor(masterQuery, editTable, query);
                } else {
                    return mCursorFactory.newCursor(db, masterQuery, editTable, query);
                }
            }
        }, supportQuery.getSql(), new String[0], null, signal);
    }

    /**
     * Runs the provided SQL and returns a {@link Cursor} over the result set.
     *
     * @param sql the SQL query. The SQL string must not be ; terminated
     * @param selectionArgs You may include ?s in where clause in the query,
     *     which will be replaced by the values from selectionArgs.
     * @return A {@link Cursor} object, which is positioned before the first entry. Note that
     * {@link Cursor}s are not synchronized, see the documentation for more details.
     */
    public Cursor rawQuery(String sql, Object[] selectionArgs) {
        return rawQueryWithFactory(null, sql, selectionArgs, null, null);
    }

    /**
     * Runs the provided SQL and returns a {@link Cursor} over the result set.
     *
     * @param sql the SQL query. The SQL string must not be ; terminated
     * @param selectionArgs You may include ?s in where clause in the query,
     *     which will be replaced by the values from selectionArgs.
     * @param cancellationSignal A signal to cancel the operation in progress, or null if none.
     * If the operation is canceled, then {@link OperationCanceledException} will be thrown
     * when the query is executed.
     * @return A {@link Cursor} object, which is positioned before the first entry. Note that
     * {@link Cursor}s are not synchronized, see the documentation for more details.
     */
    public Cursor rawQuery(String sql, Object[] selectionArgs,
            CancellationSignal cancellationSignal) {
        return rawQueryWithFactory(null, sql, selectionArgs, null, cancellationSignal);
    }

    /**
     * Runs the provided SQL and returns a cursor over the result set.
     *
     * @param cursorFactory the cursor factory to use, or null for the default factory
     * @param sql the SQL query. The SQL string must not be ; terminated
     * @param selectionArgs You may include ?s in where clause in the query,
     *     which will be replaced by the values from selectionArgs.
     * @param editTable the name of the first table, which is editable
     * @return A {@link Cursor} object, which is positioned before the first entry. Note that
     * {@link Cursor}s are not synchronized, see the documentation for more details.
     */
    public Cursor rawQueryWithFactory(
            CursorFactory cursorFactory, String sql, Object[] selectionArgs,
            String editTable) {
        return rawQueryWithFactory(cursorFactory, sql, selectionArgs, editTable, null);
    }

    /**
     * Runs the provided SQL and returns a cursor over the result set.
     *
     * @param cursorFactory the cursor factory to use, or null for the default factory
     * @param sql the SQL query. The SQL string must not be ; terminated
     * @param selectionArgs You may include ?s in where clause in the query,
     *     which will be replaced by the values from selectionArgs.
     * @param editTable the name of the first table, which is editable
     * @param cancellationSignal A signal to cancel the operation in progress, or null if none.
     * If the operation is canceled, then {@link OperationCanceledException} will be thrown
     * when the query is executed.
     * @return A {@link Cursor} object, which is positioned before the first entry. Note that
     * {@link Cursor}s are not synchronized, see the documentation for more details.
     */
    public Cursor rawQueryWithFactory(
            CursorFactory cursorFactory, String sql, Object[] selectionArgs,
            String editTable, CancellationSignal cancellationSignal) {
        acquireReference();
        try {
            SQLiteCursorDriver driver = new SQLiteDirectCursorDriver(this, sql, editTable,
                    cancellationSignal);
            return driver.query(cursorFactory != null ? cursorFactory : mCursorFactory,
                    selectionArgs);
        } finally {
            releaseReference();
        }
    }

    /**
     * Convenience method for inserting a row into the database.
     *
     * @param table the table to insert the row into
     * @param nullColumnHack optional; may be <code>null</code>.
     *            SQL doesn't allow inserting a completely empty row without
     *            naming at least one column name.  If your provided <code>values</code> is
     *            empty, no column names are known and an empty row can't be inserted.
     *            If not set to null, the <code>nullColumnHack</code> parameter
     *            provides the name of nullable column name to explicitly insert a NULL into
     *            in the case where your <code>values</code> is empty.
     * @param values this map contains the initial column values for the
     *            row. The keys should be the column names and the values the
     *            column values
     * @return the row ID of the newly inserted row, or -1 if an error occurred
     */
    public long insert(String table, String nullColumnHack, ContentValues values) {
        try {
            return insertWithOnConflict(table, nullColumnHack, values, CONFLICT_NONE);
        } catch (SQLException e) {
            Log.e(TAG, "Error inserting " + values, e);
            return -1;
        }
    }

    /**
     * Convenience method for inserting a row into the database.
     *
     * @param table the table to insert the row into
     * @param nullColumnHack optional; may be <code>null</code>.
     *            SQL doesn't allow inserting a completely empty row without
     *            naming at least one column name.  If your provided <code>values</code> is
     *            empty, no column names are known and an empty row can't be inserted.
     *            If not set to null, the <code>nullColumnHack</code> parameter
     *            provides the name of nullable column name to explicitly insert a NULL into
     *            in the case where your <code>values</code> is empty.
     * @param values this map contains the initial column values for the
     *            row. The keys should be the column names and the values the
     *            column values
     * @throws SQLException
     * @return the row ID of the newly inserted row, or -1 if an error occurred
     */
    public long insertOrThrow(String table, String nullColumnHack, ContentValues values)
            throws SQLException {
        return insertWithOnConflict(table, nullColumnHack, values, CONFLICT_NONE);
    }

    /**
     * Convenience method for replacing a row in the database.
     *
     * @param table the table in which to replace the row
     * @param nullColumnHack optional; may be <code>null</code>.
     *            SQL doesn't allow inserting a completely empty row without
     *            naming at least one column name.  If your provided <code>initialValues</code> is
     *            empty, no column names are known and an empty row can't be inserted.
     *            If not set to null, the <code>nullColumnHack</code> parameter
     *            provides the name of nullable column name to explicitly insert a NULL into
     *            in the case where your <code>initialValues</code> is empty.
     * @param initialValues this map contains the initial column values for
     *   the row.
     * @return the row ID of the newly inserted row, or -1 if an error occurred
     */
    public long replace(String table, String nullColumnHack, ContentValues initialValues) {
        try {
            return insertWithOnConflict(table, nullColumnHack, initialValues,
                    CONFLICT_REPLACE);
        } catch (SQLException e) {
            Log.e(TAG, "Error inserting " + initialValues, e);
            return -1;
        }
    }

    /**
     * Convenience method for replacing a row in the database.
     *
     * @param table the table in which to replace the row
     * @param nullColumnHack optional; may be <code>null</code>.
     *            SQL doesn't allow inserting a completely empty row without
     *            naming at least one column name.  If your provided <code>initialValues</code> is
     *            empty, no column names are known and an empty row can't be inserted.
     *            If not set to null, the <code>nullColumnHack</code> parameter
     *            provides the name of nullable column name to explicitly insert a NULL into
     *            in the case where your <code>initialValues</code> is empty.
     * @param initialValues this map contains the initial column values for
     *   the row. The key
     * @throws SQLException
     * @return the row ID of the newly inserted row, or -1 if an error occurred
     */
    public long replaceOrThrow(String table, String nullColumnHack,
            ContentValues initialValues) throws SQLException {
        return insertWithOnConflict(table, nullColumnHack, initialValues,
                CONFLICT_REPLACE);
    }

    /**
     * General method for inserting a row into the database.
     *
     * @param table the table to insert the row into
     * @param conflictAlgorithm for insert conflict resolver
     * @param values this map contains the initial column values for the
     *            row. The keys should be the column names and the values the
     *            column values
     * @return the row ID of the newly inserted row
     * OR the primary key of the existing row if the input param 'conflictAlgorithm' =
     * {@link #CONFLICT_IGNORE}
     * OR -1 if any error
     */
    @Override
    public long insert(String table, @ConflictAlgorithm int conflictAlgorithm,
           ContentValues values) throws SQLException {
        return insertWithOnConflict(table, null, values, conflictAlgorithm);
    }

    /**
     * General method for inserting a row into the database.
     *
     * @param table the table to insert the row into
     * @param nullColumnHack optional; may be <code>null</code>.
     *            SQL doesn't allow inserting a completely empty row without
     *            naming at least one column name.  If your provided <code>initialValues</code> is
     *            empty, no column names are known and an empty row can't be inserted.
     *            If not set to null, the <code>nullColumnHack</code> parameter
     *            provides the name of nullable column name to explicitly insert a NULL into
     *            in the case where your <code>initialValues</code> is empty.
     * @param initialValues this map contains the initial column values for the
     *            row. The keys should be the column names and the values the
     *            column values
     * @param conflictAlgorithm for insert conflict resolver
     * @return the row ID of the newly inserted row
     * OR the primary key of the existing row if the input param 'conflictAlgorithm' =
     * {@link #CONFLICT_IGNORE}
     * OR -1 if any error
     */
    @SuppressWarnings("StringConcatenationInsideStringBufferAppend")
    public long insertWithOnConflict(String table, String nullColumnHack,
            ContentValues initialValues, @ConflictAlgorithm int conflictAlgorithm) {
        acquireReference();
        try {
            StringBuilder sql = new StringBuilder();
            sql.append("INSERT");
            sql.append(CONFLICT_VALUES[conflictAlgorithm]);
            sql.append(" INTO ");
            sql.append(table);
            sql.append('(');

            Object[] bindArgs = null;
            int size = (initialValues != null && initialValues.size() > 0)
                    ? initialValues.size() : 0;
            if (size > 0) {
                bindArgs = new Object[size];
                int i = 0;
                for (Map.Entry<String, Object> entry : initialValues.valueSet()) {
                    sql.append((i > 0) ? "," : "");
                    sql.append(entry.getKey());
                    bindArgs[i++] = entry.getValue();
                }
                sql.append(')');
                sql.append(" VALUES (");
                for (i = 0; i < size; i++) {
                    sql.append((i > 0) ? ",?" : "?");
                }
            } else {
                sql.append(nullColumnHack + ") VALUES (NULL");
            }
            sql.append(')');

            SQLiteStatement statement = new SQLiteStatement(this, sql.toString(), bindArgs);
            try {
                return statement.executeInsert();
            } finally {
                statement.close();
            }
        } finally {
            releaseReference();
        }
    }

    /**
     * Convenience method for deleting rows in the database.
     *
     * @param table the table to delete from
     * @param whereClause the optional WHERE clause to apply when deleting.
     *            Passing null will delete all rows.
     * @param whereArgs You may include ?s in the where clause, which
     *            will be replaced by the values from whereArgs. The values
     *            will be bound as Strings.
     * @return the number of rows affected if a whereClause is passed in, 0
     *         otherwise. To remove all rows and get a count pass "1" as the
     *         whereClause.
     */
    public int delete(String table, String whereClause, String[] whereArgs) {
        acquireReference();
        try {
            SQLiteStatement statement =  new SQLiteStatement(this, "DELETE FROM " + table +
                    (!TextUtils.isEmpty(whereClause) ? " WHERE " + whereClause : ""), whereArgs);
            try {
                return statement.executeUpdateDelete();
            } finally {
                statement.close();
            }
        } finally {
            releaseReference();
        }
    }

    /**
     * Convenience method for deleting rows in the database.
     *
     * @param table the table to delete from
     * @param whereClause the optional WHERE clause to apply when deleting.
     *            Passing null will delete all rows.
     * @param whereArgs You may include ?s in the where clause, which
     *            will be replaced by the values from whereArgs. The values
     *            will be bound as Strings.
     * @return the number of rows affected if a whereClause is passed in, 0
     *         otherwise. To remove all rows and get a count pass "1" as the
     *         whereClause.
     */
    @Override
    public int delete(String table, String whereClause, Object[] whereArgs) {
        acquireReference();
        try {
            SQLiteStatement statement =  new SQLiteStatement(this, "DELETE FROM " + table +
                    (!TextUtils.isEmpty(whereClause) ? " WHERE " + whereClause : ""), whereArgs);
            try {
                return statement.executeUpdateDelete();
            } finally {
                statement.close();
            }
        } finally {
            releaseReference();
        }
    }

    /**
     * Convenience method for updating rows in the database.
     *
     * @param table the table to update in
     * @param values a map from column names to new column values. null is a
     *            valid value that will be translated to NULL.
     * @param whereClause the optional WHERE clause to apply when updating.
     *            Passing null will update all rows.
     * @param whereArgs You may include ?s in the where clause, which
     *            will be replaced by the values from whereArgs. The values
     *            will be bound as Strings.
     * @return the number of rows affected
     */
    public int update(String table, ContentValues values, String whereClause, String[] whereArgs) {
        return updateWithOnConflict(table, values, whereClause, whereArgs, CONFLICT_NONE);
    }

    /**
     * Convenience method for updating rows in the database.
     *
     * @param table the table to update in
     * @param values a map from column names to new column values. null is a
     *            valid value that will be translated to NULL.
     * @param whereClause the optional WHERE clause to apply when updating.
     *            Passing null will update all rows.
     * @param whereArgs You may include ?s in the where clause, which
     *            will be replaced by the values from whereArgs. The values
     *            will be bound as Strings.
     * @param conflictAlgorithm for update conflict resolver
     * @return the number of rows affected
     */
    @Override
    public int update(String table, @ConflictAlgorithm int conflictAlgorithm, ContentValues values,
                      String whereClause,  Object[] whereArgs) {
        if (values == null || values.size() == 0) {
            throw new IllegalArgumentException("Empty values");
        }

        acquireReference();
        try {
            StringBuilder sql = new StringBuilder(120);
            sql.append("UPDATE ");
            sql.append(CONFLICT_VALUES[conflictAlgorithm]);
            sql.append(table);
            sql.append(" SET ");

            // move all bind args to one array
            int setValuesSize = values.size();
            int bindArgsSize = (whereArgs == null) ? setValuesSize : (setValuesSize + whereArgs.length);
            Object[] bindArgs = new Object[bindArgsSize];
            int i = 0;
            for (Map.Entry<String, Object> entry : values.valueSet()) {
                sql.append((i > 0) ? "," : "");
                sql.append(entry.getKey());
                bindArgs[i++] = entry.getValue();
                sql.append("=?");
            }
            if (whereArgs != null) {
                for (i = setValuesSize; i < bindArgsSize; i++) {
                    bindArgs[i] = whereArgs[i - setValuesSize];
                }
            }
            if (!TextUtils.isEmpty(whereClause)) {
                sql.append(" WHERE ");
                sql.append(whereClause);
            }

            SQLiteStatement statement = new SQLiteStatement(this, sql.toString(), bindArgs);
            try {
                return statement.executeUpdateDelete();
            } finally {
                statement.close();
            }
        } finally {
            releaseReference();
        }
    }

    /**
     * Convenience method for updating rows in the database.
     *
     * @param table the table to update in
     * @param values a map from column names to new column values. null is a
     *            valid value that will be translated to NULL.
     * @param whereClause the optional WHERE clause to apply when updating.
     *            Passing null will update all rows.
     * @param whereArgs You may include ?s in the where clause, which
     *            will be replaced by the values from whereArgs. The values
     *            will be bound as Strings.
     * @param conflictAlgorithm for update conflict resolver
     * @return the number of rows affected
     */
    public int updateWithOnConflict(String table, ContentValues values,
            String whereClause, String[] whereArgs, @ConflictAlgorithm int conflictAlgorithm) {
        if (values == null || values.size() == 0) {
            throw new IllegalArgumentException("Empty values");
        }

        acquireReference();
        try {
            StringBuilder sql = new StringBuilder(120);
            sql.append("UPDATE ");
            sql.append(CONFLICT_VALUES[conflictAlgorithm]);
            sql.append(table);
            sql.append(" SET ");

            // move all bind args to one array
            int setValuesSize = values.size();
            int bindArgsSize = (whereArgs == null) ? setValuesSize : (setValuesSize + whereArgs.length);
            Object[] bindArgs = new Object[bindArgsSize];
            int i = 0;
            for (Map.Entry<String, Object> entry : values.valueSet()) {
                sql.append((i > 0) ? "," : "");
                sql.append(entry.getKey());
                bindArgs[i++] = entry.getValue();
                sql.append("=?");
            }
            if (whereArgs != null) {
                for (i = setValuesSize; i < bindArgsSize; i++) {
                    bindArgs[i] = whereArgs[i - setValuesSize];
                }
            }
            if (!TextUtils.isEmpty(whereClause)) {
                sql.append(" WHERE ");
                sql.append(whereClause);
            }

            SQLiteStatement statement = new SQLiteStatement(this, sql.toString(), bindArgs);
            try {
                return statement.executeUpdateDelete();
            } finally {
                statement.close();
            }
        } finally {
            releaseReference();
        }
    }

    /**
     * Execute a single SQL statement that is NOT a SELECT
     * or any other SQL statement that returns data.
     * <p>
     * It has no means to return any data (such as the number of affected rows).
     * Instead, you're encouraged to use {@link #insert(String, String, ContentValues)},
     * {@link #update(String, ContentValues, String, String[])}, et al, when possible.
     * </p>
     * <p>
     * When using {@link #enableWriteAheadLogging()}, journal_mode is
     * automatically managed by this class. So, do not set journal_mode
     * using "PRAGMA journal_mode'<value>" statement if your app is using
     * {@link #enableWriteAheadLogging()}
     * </p>
     *
     * @param sql the SQL statement to be executed. Multiple statements separated by semicolons are
     * not supported.
     * @throws SQLException if the SQL string is invalid
     */
    @Override
    public void execSQL(String sql) throws SQLException {
        executeSql(sql, null);
    }

    /**
     * Execute a single SQL statement that is NOT a SELECT/INSERT/UPDATE/DELETE.
     * <p>
     * For INSERT statements, use any of the following instead.
     * <ul>
     *   <li>{@link #insert(String, String, ContentValues)}</li>
     *   <li>{@link #insertOrThrow(String, String, ContentValues)}</li>
     *   <li>{@link #insertWithOnConflict(String, String, ContentValues, int)}</li>
     * </ul>
     * <p>
     * For UPDATE statements, use any of the following instead.
     * <ul>
     *   <li>{@link #update(String, ContentValues, String, String[])}</li>
     *   <li>{@link #updateWithOnConflict(String, ContentValues, String, String[], int)}</li>
     * </ul>
     * <p>
     * For DELETE statements, use any of the following instead.
     * <ul>
     *   <li>{@link #delete(String, String, String[])}</li>
     * </ul>
     * <p>
     * For example, the following are good candidates for using this method:
     * <ul>
     *   <li>ALTER TABLE</li>
     *   <li>CREATE or DROP table / trigger / view / index / virtual table</li>
     *   <li>REINDEX</li>
     *   <li>RELEASE</li>
     *   <li>SAVEPOINT</li>
     *   <li>PRAGMA that returns no data</li>
     * </ul>
     * </p>
     * <p>
     * When using {@link #enableWriteAheadLogging()}, journal_mode is
     * automatically managed by this class. So, do not set journal_mode
     * using "PRAGMA journal_mode'<value>" statement if your app is using
     * {@link #enableWriteAheadLogging()}
     * </p>
     *
     * @param sql the SQL statement to be executed. Multiple statements separated by semicolons are
     * not supported.
     * @param bindArgs only byte[], String, Long and Double are supported in bindArgs.
     * @throws SQLException if the SQL string is invalid
     */
    @Override
    public void execSQL(String sql, Object[] bindArgs) throws SQLException {
        if (bindArgs == null) {
            throw new IllegalArgumentException("Empty bindArgs");
        }
        executeSql(sql, bindArgs);
    }

    private int executeSql(String sql, Object[] bindArgs) throws SQLException {
        acquireReference();
        try {
            SQLiteStatement statement = new SQLiteStatement(this, sql, bindArgs);
            try {
                return statement.executeUpdateDelete();
            } finally {
                statement.close();
            }
        } finally {
            releaseReference();
        }
    }

    /**
     * Verifies that a SQL SELECT statement is valid by compiling it.
     * If the SQL statement is not valid, this method will throw a {@link SQLiteException}.
     *
     * @param sql SQL to be validated
     * @param cancellationSignal A signal to cancel the operation in progress, or null if none.
     * If the operation is canceled, then {@link OperationCanceledException} will be thrown
     * when the query is executed.
     * @throws SQLiteException if {@code sql} is invalid
     */
    public void validateSql(@NonNull String sql, @Nullable CancellationSignal cancellationSignal) {
             getThreadSession().prepare(sql,
                     getThreadDefaultConnectionFlags(true), cancellationSignal, null);
    }

    /**
     * Returns true if the database is opened as read only.
     *
     * @return True if database is opened as read only.
     */
    @Override
    public boolean isReadOnly() {
        synchronized (mLock) {
            return isReadOnlyLocked();
        }
    }

    private boolean isReadOnlyLocked() {
        return (mConfigurationLocked.openFlags & OPEN_READONLY) == OPEN_READONLY;
    }

    /**
     * Returns true if the database is in-memory db.
     *
     * @return True if the database is in-memory.
     * @hide
     */
    public boolean isInMemoryDatabase() {
        synchronized (mLock) {
            return mConfigurationLocked.isInMemoryDb();
        }
    }

    /**
     * Returns true if the database is currently open.
     *
     * @return True if the database is currently open (has not been closed).
     */
    @Override
    public boolean isOpen() {
        synchronized (mLock) {
            return mConnectionPoolLocked != null;
        }
    }

    /**
     * Returns true if the new version code is greater than the current database version.
     *
     * @param newVersion The new version code.
     * @return True if the new version code is greater than the current database version.
     */
    @Override
    public boolean needUpgrade(int newVersion) {
        return newVersion > getVersion();
    }

    /**
     * Gets the path to the database file.
     *
     * @return The path to the database file.
     */
    @Override
    public final String getPath() {
        synchronized (mLock) {
            return mConfigurationLocked.path;
        }
    }

    /**
     * Sets the locale for this database.
     *
     * @param locale The new locale.
     *
     * @throws SQLException if the locale could not be set.  The most common reason
     * for this is that there is no collator available for the locale you requested.
     * In this case the database remains unchanged.
     */
    @Override
    public void setLocale(Locale locale) {
        if (locale == null) {
            throw new IllegalArgumentException("locale must not be null.");
        }

        synchronized (mLock) {
            throwIfNotOpenLocked();

            final Locale oldLocale = mConfigurationLocked.locale;
            mConfigurationLocked.locale = locale;
            try {
                mConnectionPoolLocked.reconfigure(mConfigurationLocked);
            } catch (RuntimeException ex) {
                mConfigurationLocked.locale = oldLocale;
                throw ex;
            }
        }
    }

    /**
     * Sets the maximum size of the prepared-statement cache for this database.
     * (size of the cache = number of compiled-sql-statements stored in the cache).
     *<p>
     * Maximum cache size can ONLY be increased from its current size (default = 10).
     * If this method is called with smaller size than the current maximum value,
     * then IllegalStateException is thrown.
     *<p>
     * This method is thread-safe.
     *
     * @param cacheSize the size of the cache. can be (0 to {@link #MAX_SQL_CACHE_SIZE})
     * @throws IllegalStateException if input cacheSize > {@link #MAX_SQL_CACHE_SIZE}.
     */
    @Override
    public void setMaxSqlCacheSize(int cacheSize) {
        if (cacheSize > MAX_SQL_CACHE_SIZE || cacheSize < 0) {
            throw new IllegalStateException(
                    "expected value between 0 and " + MAX_SQL_CACHE_SIZE);
        }

        synchronized (mLock) {
            throwIfNotOpenLocked();

            final int oldMaxSqlCacheSize = mConfigurationLocked.maxSqlCacheSize;
            mConfigurationLocked.maxSqlCacheSize = cacheSize;
            try {
                mConnectionPoolLocked.reconfigure(mConfigurationLocked);
            } catch (RuntimeException ex) {
                mConfigurationLocked.maxSqlCacheSize = oldMaxSqlCacheSize;
                throw ex;
            }
        }
    }

    /**
     * Sets whether foreign key constraints are enabled for the database.
     * <p>
     * By default, foreign key constraints are not enforced by the database.
     * This method allows an application to enable foreign key constraints.
     * It must be called each time the database is opened to ensure that foreign
     * key constraints are enabled for the session.
     * </p><p>
     * A good time to call this method is right after calling {@link #openOrCreateDatabase}
     * or in the {@link SQLiteOpenHelper#onConfigure} callback.
     * </p><p>
     * When foreign key constraints are disabled, the database does not check whether
     * changes to the database will violate foreign key constraints.  Likewise, when
     * foreign key constraints are disabled, the database will not execute cascade
     * delete or update triggers.  As a result, it is possible for the database
     * state to become inconsistent.  To perform a database integrity check,
     * call {@link #isDatabaseIntegrityOk}.
     * </p><p>
     * This method must not be called while a transaction is in progress.
     * </p><p>
     * See also <a href="http://sqlite.org/foreignkeys.html">SQLite Foreign Key Constraints</a>
     * for more details about foreign key constraint support.
     * </p>
     *
     * @param enable True to enable foreign key constraints, false to disable them.
     *
     * @throws IllegalStateException if the are transactions is in progress
     * when this method is called.
     */
    @Override
    public void setForeignKeyConstraintsEnabled(boolean enable) {
        synchronized (mLock) {
            throwIfNotOpenLocked();

            if (mConfigurationLocked.foreignKeyConstraintsEnabled == enable) {
                return;
            }

            mConfigurationLocked.foreignKeyConstraintsEnabled = enable;
            try {
                mConnectionPoolLocked.reconfigure(mConfigurationLocked);
            } catch (RuntimeException ex) {
                mConfigurationLocked.foreignKeyConstraintsEnabled = !enable;
                throw ex;
            }
        }
    }

    /**
     * This method enables parallel execution of queries from multiple threads on the
     * same database.  It does this by opening multiple connections to the database
     * and using a different database connection for each query.  The database
     * journal mode is also changed to enable writes to proceed concurrently with reads.
     * <p>
     * When write-ahead logging is not enabled (the default), it is not possible for
     * reads and writes to occur on the database at the same time.  Before modifying the
     * database, the writer implicitly acquires an exclusive lock on the database which
     * prevents readers from accessing the database until the write is completed.
     * </p><p>
     * In contrast, when write-ahead logging is enabled (by calling this method), write
     * operations occur in a separate log file which allows reads to proceed concurrently.
     * While a write is in progress, readers on other threads will perceive the state
     * of the database as it was before the write began.  When the write completes, readers
     * on other threads will then perceive the new state of the database.
     * </p><p>
     * It is a good idea to enable write-ahead logging whenever a database will be
     * concurrently accessed and modified by multiple threads at the same time.
     * However, write-ahead logging uses significantly more memory than ordinary
     * journaling because there are multiple connections to the same database.
     * So if a database will only be used by a single thread, or if optimizing
     * concurrency is not very important, then write-ahead logging should be disabled.
     * </p><p>
     * After calling this method, execution of queries in parallel is enabled as long as
     * the database remains open.  To disable execution of queries in parallel, either
     * call {@link #disableWriteAheadLogging} or close the database and reopen it.
     * </p><p>
     * The maximum number of connections used to execute queries in parallel is
     * dependent upon the device memory and possibly other properties.
     * </p><p>
     * If a query is part of a transaction, then it is executed on the same database handle the
     * transaction was begun.
     * </p><p>
     * Writers should use {@link #beginTransactionNonExclusive()} or
     * {@link #beginTransactionWithListenerNonExclusive(SQLiteTransactionListener)}
     * to start a transaction.  Non-exclusive mode allows database file to be in readable
     * by other threads executing queries.
     * </p><p>
     * If the database has any attached databases, then execution of queries in parallel is NOT
     * possible.  Likewise, write-ahead logging is not supported for read-only databases
     * or memory databases.  In such cases, {@link #enableWriteAheadLogging} returns false.
     * </p><p>
     * The best way to enable write-ahead logging is to pass the
     * {@link #ENABLE_WRITE_AHEAD_LOGGING} flag to {@link #openDatabase}.  This is
     * more efficient than calling {@link #enableWriteAheadLogging}.
     * <code><pre>
     *     SQLiteDatabase db = SQLiteDatabase.openDatabase("db_filename", cursorFactory,
     *             SQLiteDatabase.CREATE_IF_NECESSARY | SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING,
     *             myDatabaseErrorHandler);
     *     db.enableWriteAheadLogging();
     * </pre></code>
     * </p><p>
     * Another way to enable write-ahead logging is to call {@link #enableWriteAheadLogging}
     * after opening the database.
     * <code><pre>
     *     SQLiteDatabase db = SQLiteDatabase.openDatabase("db_filename", cursorFactory,
     *             SQLiteDatabase.CREATE_IF_NECESSARY, myDatabaseErrorHandler);
     *     db.enableWriteAheadLogging();
     * </pre></code>
     * </p><p>
     * See also <a href="http://sqlite.org/wal.html">SQLite Write-Ahead Logging</a> for
     * more details about how write-ahead logging works.
     * </p>
     *
     * @return True if write-ahead logging is enabled.
     *
     * @throws IllegalStateException if there are transactions in progress at the
     * time this method is called.  WAL mode can only be changed when there are no
     * transactions in progress.
     *
     * @see #ENABLE_WRITE_AHEAD_LOGGING
     * @see #disableWriteAheadLogging
     */
    @Override
    public boolean enableWriteAheadLogging() {
        synchronized (mLock) {
            throwIfNotOpenLocked();

            if ((mConfigurationLocked.openFlags & ENABLE_WRITE_AHEAD_LOGGING) != 0) {
                return true;
            }

            if (isReadOnlyLocked()) {
                // WAL doesn't make sense for readonly-databases.
                // TODO: True, but connection pooling does still make sense...
                return false;
            }

            if (mConfigurationLocked.isInMemoryDb()) {
                Log.i(TAG, "can't enable WAL for memory databases.");
                return false;
            }

            mConfigurationLocked.openFlags |= ENABLE_WRITE_AHEAD_LOGGING;
            try {
                mConnectionPoolLocked.reconfigure(mConfigurationLocked);
            } catch (RuntimeException ex) {
                mConfigurationLocked.openFlags &= ~ENABLE_WRITE_AHEAD_LOGGING;
                throw ex;
            }
        }
        return true;
    }

    /**
     * This method disables the features enabled by {@link #enableWriteAheadLogging()}.
     *
     * @throws IllegalStateException if there are transactions in progress at the
     * time this method is called.  WAL mode can only be changed when there are no
     * transactions in progress.
     *
     * @see #enableWriteAheadLogging
     */
    @Override
    public void disableWriteAheadLogging() {
        synchronized (mLock) {
            throwIfNotOpenLocked();

            if ((mConfigurationLocked.openFlags & ENABLE_WRITE_AHEAD_LOGGING) == 0) {
                return;
            }

            mConfigurationLocked.openFlags &= ~ENABLE_WRITE_AHEAD_LOGGING;
            try {
                mConnectionPoolLocked.reconfigure(mConfigurationLocked);
            } catch (RuntimeException ex) {
                mConfigurationLocked.openFlags |= ENABLE_WRITE_AHEAD_LOGGING;
                throw ex;
            }
        }
    }

    /**
     * Returns true if write-ahead logging has been enabled for this database.
     *
     * @return True if write-ahead logging has been enabled for this database.
     *
     * @see #enableWriteAheadLogging
     * @see #ENABLE_WRITE_AHEAD_LOGGING
     */
    @Override
    public boolean isWriteAheadLoggingEnabled() {
        synchronized (mLock) {
            throwIfNotOpenLocked();

            return (mConfigurationLocked.openFlags & ENABLE_WRITE_AHEAD_LOGGING) != 0;
        }
    }

    /**
     * Collect statistics about all open databases in the current process.
     * Used by bug report.
     */
    static ArrayList<SQLiteDebug.DbStats> getDbStats() {
        ArrayList<SQLiteDebug.DbStats> dbStatsList = new ArrayList<>();
        for (SQLiteDatabase db : getActiveDatabases()) {
            db.collectDbStats(dbStatsList);
        }
        return dbStatsList;
    }

    private void collectDbStats(ArrayList<SQLiteDebug.DbStats> dbStatsList) {
        synchronized (mLock) {
            if (mConnectionPoolLocked != null) {
                mConnectionPoolLocked.collectDbStats(dbStatsList);
            }
        }
    }

    private static ArrayList<SQLiteDatabase> getActiveDatabases() {
        ArrayList<SQLiteDatabase> databases = new ArrayList<>();
        synchronized (sActiveDatabases) {
            databases.addAll(sActiveDatabases.keySet());
        }
        return databases;
    }

    /**
     * Dump detailed information about all open databases in the current process.
     * Used by bug report.
     */
    static void dumpAll(Printer printer, boolean verbose) {
        for (SQLiteDatabase db : getActiveDatabases()) {
            db.dump(printer, verbose);
        }
    }

    private void dump(Printer printer, boolean verbose) {
        synchronized (mLock) {
            if (mConnectionPoolLocked != null) {
                printer.println("");
                mConnectionPoolLocked.dump(printer, verbose);
            }
        }
    }

    /**
     * Returns list of full pathnames of all attached databases including the main database
     * by executing 'pragma database_list' on the database.
     *
     * @return ArrayList of pairs of (database name, database file path) or null if the database
     * is not open.
     */
    @Override
    public List<Pair<String, String>> getAttachedDbs() {
        ArrayList<Pair<String, String>> attachedDbs = new ArrayList<>();
        synchronized (mLock) {
            if (mConnectionPoolLocked == null) {
                return null; // not open
            }

            acquireReference();
        }

        try {
            // has attached databases. query sqlite to get the list of attached databases.
            Cursor c = null;
            try {
                c = rawQuery("pragma database_list;", null);
                while (c.moveToNext()) {
                    // sqlite returns a row for each database in the returned list of databases.
                    //   in each row,
                    //       1st column is the database name such as main, or the database
                    //                              name specified on the "ATTACH" command
                    //       2nd column is the database file path.
                    attachedDbs.add(new Pair<>(c.getString(1), c.getString(2)));
                }
            } finally {
                if (c != null) {
                    c.close();
                }
            }
            return attachedDbs;
        } finally {
            releaseReference();
        }
    }

    /**
     * Runs 'pragma integrity_check' on the given database (and all the attached databases)
     * and returns true if the given database (and all its attached databases) pass integrity_check,
     * false otherwise.
     *<p>
     * If the result is false, then this method logs the errors reported by the integrity_check
     * command execution.
     *<p>
     * Note that 'pragma integrity_check' on a database can take a long time.
     *
     * @return true if the given database (and all its attached databases) pass integrity_check,
     * false otherwise.
     */
    @Override
    public boolean isDatabaseIntegrityOk() {
        acquireReference();
        try {
            List<Pair<String, String>> attachedDbs;
            try {
                attachedDbs = getAttachedDbs();
                if (attachedDbs == null) {
                    throw new IllegalStateException("databaselist for: " + getPath() + " couldn't " +
                            "be retrieved. probably because the database is closed");
                }
            } catch (SQLiteException e) {
                // can't get attachedDb list. do integrity check on the main database
                attachedDbs = new ArrayList<>();
                attachedDbs.add(new Pair<>("main", getPath()));
            }

            for (Pair<String, String> p : attachedDbs) {
                SQLiteStatement prog = null;
                try {
                    prog = compileStatement("PRAGMA " + p.first + ".integrity_check(1);");
                    String rslt = prog.simpleQueryForString();
                    if (!rslt.equalsIgnoreCase("ok")) {
                        // integrity_checker failed on main or attached databases
                        Log.e(TAG, "PRAGMA integrity_check on " + p.second + " returned: " + rslt);
                        return false;
                    }
                } finally {
                    if (prog != null) prog.close();
                }
            }
        } finally {
            releaseReference();
        }
        return true;
    }

    @Override
    public String toString() {
        return "SQLiteDatabase: " + getPath();
    }

    private void throwIfNotOpenLocked() {
        if (mConnectionPoolLocked == null) {
            throw new IllegalStateException("The database '" + mConfigurationLocked.label
                    + "' is not open.");
        }
    }

    /**
     * Used to allow returning sub-classes of {@link Cursor} when calling query.
     */
    public interface CursorFactory {
        /**
         * See {@link SQLiteCursor#SQLiteCursor(SQLiteCursorDriver, String, SQLiteQuery)}.
         */
        Cursor newCursor(SQLiteDatabase db,
                         SQLiteCursorDriver masterQuery, String editTable,
                         SQLiteQuery query);
    }

    /**
     * A callback interface for a custom sqlite3 function. This can be used to create a function
     * that can be called from sqlite3 database triggers.
     *
     * This interface is deprecated; new code should prefer {@link Function}
     */
    @Deprecated
    public interface CustomFunction {
        /**
         * Invoked whenever the function is called.
         * @param args function arguments
         * @return String value of the result or null
         */
        String callback(String[] args);
    }

    /**
     * A callback interface for a custom sqlite3 function. This can be used to create a function
     * that can be called from sqlite3 database triggers, or used in queries.
     */
    public interface Function {
        /**
         * Flag that declares this function to be "deterministic,"
         *  which means it may be used with Indexes on Expressions.
         */
        public static final int FLAG_DETERMINISTIC = 0x800;

        interface Args {
            byte[] getBlob(int arg);
            String getString(int arg);
            double getDouble(int arg);
            int getInt(int arg);
            long getLong(int arg);
        }

        interface Result {
            void set(byte[] value);
            void set(double value);
            void set(int value);
            void set(long value);
            void set(String value);
            void setError(String error);
            void setNull();
        }

        /**
         * Invoked whenever the function is called.
         * @param args function arguments
         * @return String value of the result or null
         */
        void callback(Args args, Result result);
    }

    static boolean hasCodec() {
        return SQLiteConnection.hasCodec();
    }

    void enableLocalizedCollators() {
        mConnectionPoolLocked.enableLocalizedCollators();
    }

    /**
     * Query the table for the number of rows in the table.
     * @param table the name of the table to query
     * @return the number of rows in the table
     */
    public long queryNumEntries(String table) {
        return queryNumEntries(table, null, null);
    }

    /**
     * Query the table for the number of rows in the table.
     * @param table the name of the table to query
     * @param selection A filter declaring which rows to return,
     *              formatted as an SQL WHERE clause (excluding the WHERE itself).
     *              Passing null will count all rows for the given table
     * @return the number of rows in the table filtered by the selection
     */
    public long queryNumEntries(String table, String selection) {
        return queryNumEntries(table, selection, null);
    }

    /**
     * Query the table for the number of rows in the table.
     * @param table the name of the table to query
     * @param selection A filter declaring which rows to return,
     *              formatted as an SQL WHERE clause (excluding the WHERE itself).
     *              Passing null will count all rows for the given table
     * @param selectionArgs You may include ?s in selection,
     *              which will be replaced by the values from selectionArgs,
     *              in order that they appear in the selection.
     *              The values will be bound as Strings.
     * @return the number of rows in the table filtered by the selection
     */
    public long queryNumEntries(String table, String selection, String[] selectionArgs) {
        String s = (!TextUtils.isEmpty(selection)) ? " where " + selection : "";
        return longForQuery("select count(*) from " + table + s, selectionArgs);
    }

    /**
     * Utility method to run the query on the db and return the value in the
     * first column of the first row.
     */
    public long longForQuery(String query, String[] selectionArgs) {
        SQLiteStatement prog = compileStatement(query);
        try {
            return longForQuery(prog, selectionArgs);
        } finally {
            prog.close();
        }
    }

    /**
     * Utility method to run the pre-compiled query and return the value in the
     * first column of the first row.
     */
    private static long longForQuery(SQLiteStatement prog, String[] selectionArgs) {
        prog.bindAllArgsAsStrings(selectionArgs);
        return prog.simpleQueryForLong();
    }

    /**
     * Utility method to run the query on the db and return the value in the
     * first column of the first row.
     */
    public String stringForQuery(String query, String[] selectionArgs) {
        SQLiteStatement prog = compileStatement(query);
        try {
            return stringForQuery(prog, selectionArgs);
        } finally {
            prog.close();
        }
    }

    /**
     * Utility method to run the pre-compiled query and return the value in the
     * first column of the first row.
     */
    public static String stringForQuery(SQLiteStatement prog, String[] selectionArgs) {
        prog.bindAllArgsAsStrings(selectionArgs);
        return prog.simpleQueryForString();
    }

    /**
     * Utility method to run the query on the db and return the blob value in the
     * first column of the first row.
     *
     * @return A read-only file descriptor for a copy of the blob value.
     */
    public ParcelFileDescriptor blobFileDescriptorForQuery(String query, String[] selectionArgs) {
        SQLiteStatement prog = compileStatement(query);
        try {
            return blobFileDescriptorForQuery(prog, selectionArgs);
        } finally {
            prog.close();
        }
    }

    /**
     * Utility method to run the pre-compiled query and return the blob value in the
     * first column of the first row.
     *
     * @return A read-only file descriptor for a copy of the blob value.
     */
    public static ParcelFileDescriptor blobFileDescriptorForQuery(SQLiteStatement prog,
                                                                  String[] selectionArgs) {
        prog.bindAllArgsAsStrings(selectionArgs);
        return prog.simpleQueryForBlobFileDescriptor();
    }
}
