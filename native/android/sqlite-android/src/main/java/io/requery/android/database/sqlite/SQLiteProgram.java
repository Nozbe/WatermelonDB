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

package io.requery.android.database.sqlite;

import androidx.core.os.CancellationSignal;
import androidx.sqlite.db.SupportSQLiteProgram;

import java.util.Arrays;

/**
 * A base class for compiled SQLite programs.
 * <p>
 * This class is not thread-safe.
 * </p>
 */
@SuppressWarnings("unused")
public abstract class SQLiteProgram extends SQLiteClosable implements SupportSQLiteProgram {
    private static final String[] EMPTY_STRING_ARRAY = new String[0];

    private final SQLiteDatabase mDatabase;
    private final String mSql;
    private final boolean mReadOnly;
    private final String[] mColumnNames;
    private final int mNumParameters;
    private final Object[] mBindArgs;

    SQLiteProgram(SQLiteDatabase db, String sql, Object[] bindArgs,
            CancellationSignal cancellationSignalForPrepare) {
        mDatabase = db;
        mSql = sql.trim();

        int n = SQLiteStatementType.getSqlStatementType(mSql);
        switch (n) {
            case SQLiteStatementType.STATEMENT_BEGIN:
            case SQLiteStatementType.STATEMENT_COMMIT:
            case SQLiteStatementType.STATEMENT_ABORT:
                mReadOnly = false;
                mColumnNames = EMPTY_STRING_ARRAY;
                mNumParameters = 0;
                break;

            default:
                boolean assumeReadOnly = (n == SQLiteStatementType.STATEMENT_SELECT);
                SQLiteStatementInfo info = new SQLiteStatementInfo();
                db.getThreadSession().prepare(mSql,
                        db.getThreadDefaultConnectionFlags(assumeReadOnly),
                        cancellationSignalForPrepare, info);
                mReadOnly = info.readOnly;
                mColumnNames = info.columnNames;
                mNumParameters = info.numParameters;
                break;
        }

        if (bindArgs != null && bindArgs.length > mNumParameters) {
            throw new IllegalArgumentException("Too many bind arguments.  "
                    + bindArgs.length + " arguments were provided but the statement needs "
                    + mNumParameters + " arguments.");
        }

        if (mNumParameters != 0) {
            mBindArgs = new Object[mNumParameters];
            if (bindArgs != null) {
                System.arraycopy(bindArgs, 0, mBindArgs, 0, bindArgs.length);
            }
        } else {
            mBindArgs = null;
        }
    }

    final SQLiteDatabase getDatabase() {
        return mDatabase;
    }

    final String getSql() {
        return mSql;
    }

    final Object[] getBindArgs() {
        return mBindArgs;
    }

    final String[] getColumnNames() {
        return mColumnNames;
    }

    /** @hide */
    protected final SQLiteSession getSession() {
        return mDatabase.getThreadSession();
    }

    /** @hide */
    protected final int getConnectionFlags() {
        return mDatabase.getThreadDefaultConnectionFlags(mReadOnly);
    }

    /** @hide */
    protected final void onCorruption() {
        mDatabase.onCorruption();
    }

    /**
     * Bind a NULL value to this statement. The value remains bound until
     * {@link #clearBindings} is called.
     *
     * @param index The 1-based index to the parameter to bind null to
     */
    @Override
    public void bindNull(int index) {
        bind(index, null);
    }

    /**
     * Bind a long value to this statement. The value remains bound until
     * {@link #clearBindings} is called.
     *addToBindArgs
     * @param index The 1-based index to the parameter to bind
     * @param value The value to bind
     */
    @Override
    public void bindLong(int index, long value) {
        bind(index, value);
    }

    /**
     * Bind a double value to this statement. The value remains bound until
     * {@link #clearBindings} is called.
     *
     * @param index The 1-based index to the parameter to bind
     * @param value The value to bind
     */
    @Override
    public void bindDouble(int index, double value) {
        bind(index, value);
    }

    /**
     * Bind a String value to this statement. The value remains bound until
     * {@link #clearBindings} is called.
     *
     * @param index The 1-based index to the parameter to bind
     * @param value The value to bind, must not be null
     */
    @Override
    public void bindString(int index, String value) {
        if (value == null) {
            throw new IllegalArgumentException("the bind value at index " + index + " is null");
        }
        bind(index, value);
    }

    /**
     * Bind a byte array value to this statement. The value remains bound until
     * {@link #clearBindings} is called.
     *
     * @param index The 1-based index to the parameter to bind
     * @param value The value to bind, must not be null
     */
    @Override
    public void bindBlob(int index, byte[] value) {
        if (value == null) {
            throw new IllegalArgumentException("the bind value at index " + index + " is null");
        }
        bind(index, value);
    }

    /**
     * Binds the given Object to the given SQLiteProgram using the proper
     * typing. For example, bind numbers as longs/doubles, and everything else
     * as a string by call toString() on it.
     *
     * @param index the 1-based index to bind at
     * @param value the value to bind
     */
    public void bindObject(int index, Object value) {
        if (value == null) {
            bindNull(index);
        } else if (value instanceof Double || value instanceof Float) {
            bindDouble(index, ((Number)value).doubleValue());
        } else if (value instanceof Number) {
            bindLong(index, ((Number)value).longValue());
        } else if (value instanceof Boolean) {
            Boolean bool = (Boolean)value;
            if (bool) {
                bindLong(index, 1);
            } else {
                bindLong(index, 0);
            }
        } else if (value instanceof byte[]){
            bindBlob(index, (byte[]) value);
        } else {
            bindString(index, value.toString());
        }
    }

    /**
     * Clears all existing bindings. Unset bindings are treated as NULL.
     */
    @Override
    public void clearBindings() {
        if (mBindArgs != null) {
            Arrays.fill(mBindArgs, null);
        }
    }

    /**
     * Given an array of String bindArgs, this method binds all of them in one single call.
     *
     * @param bindArgs the String array of bind args, none of which must be null.
     */
    public void bindAllArgsAsStrings(String[] bindArgs) {
        if (bindArgs != null) {
            for (int i = bindArgs.length; i != 0; i--) {
                bindString(i, bindArgs[i - 1]);
            }
        }
    }

    @Override
    protected void onAllReferencesReleased() {
        clearBindings();
    }

    private void bind(int index, Object value) {
        if (index < 1 || index > mNumParameters) {
            throw new IllegalArgumentException("Cannot bind argument at index "
                    + index + " because the index is out of range.  "
                    + "The statement has " + mNumParameters + " parameters.");
        }
        mBindArgs[index - 1] = value;
    }
}
