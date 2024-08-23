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

import android.database.SQLException;
import android.database.sqlite.SQLiteDatabaseCorruptException;
import android.database.sqlite.SQLiteDoneException;
import android.os.ParcelFileDescriptor;
import androidx.sqlite.db.SupportSQLiteStatement;

/**
 * Represents a statement that can be executed against a database.  The statement
 * cannot return multiple rows or columns, but single value (1 x 1) result sets
 * are supported.
 * <p>
 * This class is not thread-safe.
 * </p>
 */
@SuppressWarnings("unused")
public final class SQLiteStatement extends SQLiteProgram implements SupportSQLiteStatement {

    SQLiteStatement(SQLiteDatabase db, String sql, Object[] bindArgs) {
        super(db, sql, bindArgs, null);
    }

    /**
     * Execute this SQL statement, if it is not a SELECT / INSERT / DELETE / UPDATE, for example
     * CREATE / DROP table, view, trigger, index etc.
     *
     * @throws SQLException If the SQL string is invalid for some reason
     */
    @Override
    public void execute() {
        acquireReference();
        try {
            getSession().execute(getSql(), getBindArgs(), getConnectionFlags(), null);
        } catch (SQLiteDatabaseCorruptException ex) {
            onCorruption();
            throw ex;
        } finally {
            releaseReference();
        }
    }

    /**
     * Execute this SQL statement, if the the number of rows affected by execution of this SQL
     * statement is of any importance to the caller - for example, UPDATE / DELETE SQL statements.
     *
     * @return the number of rows affected by this SQL statement execution.
     * @throws SQLException If the SQL string is invalid for some reason
     */
    @Override
    public int executeUpdateDelete() {
        acquireReference();
        try {
            return getSession().executeForChangedRowCount(
                    getSql(), getBindArgs(), getConnectionFlags(), null);
        } catch (SQLiteDatabaseCorruptException ex) {
            onCorruption();
            throw ex;
        } finally {
            releaseReference();
        }
    }

    /**
     * Execute this SQL statement and return the ID of the row inserted due to this call.
     * The SQL statement should be an INSERT for this to be a useful call.
     *
     * @return the row ID of the last row inserted, if this insert is successful. -1 otherwise.
     *
     * @throws SQLException If the SQL string is invalid for some reason
     */
    @Override
    public long executeInsert() {
        acquireReference();
        try {
            return getSession().executeForLastInsertedRowId(
                    getSql(), getBindArgs(), getConnectionFlags(), null);
        } catch (SQLiteDatabaseCorruptException ex) {
            onCorruption();
            throw ex;
        } finally {
            releaseReference();
        }
    }

    /**
     * Execute a statement that returns a 1 by 1 table with a numeric value.
     * For example, SELECT COUNT(*) FROM table;
     *
     * @return The result of the query.
     *
     * @throws SQLiteDoneException if the query returns zero rows
     */
    @Override
    public long simpleQueryForLong() {
        acquireReference();
        try {
            return getSession().executeForLong(
                    getSql(), getBindArgs(), getConnectionFlags(), null);
        } catch (SQLiteDatabaseCorruptException ex) {
            onCorruption();
            throw ex;
        } finally {
            releaseReference();
        }
    }

    /**
     * Execute a statement that returns a 1 by 1 table with a text value.
     * For example, SELECT COUNT(*) FROM table;
     *
     * @return The result of the query.
     *
     * @throws SQLiteDoneException if the query returns zero rows
     */
    @Override
    public String simpleQueryForString() {
        acquireReference();
        try {
            return getSession().executeForString(
                    getSql(), getBindArgs(), getConnectionFlags(), null);
        } catch (SQLiteDatabaseCorruptException ex) {
            onCorruption();
            throw ex;
        } finally {
            releaseReference();
        }
    }

    /**
     * Executes a statement that returns a 1 by 1 table with a blob value.
     *
     * @return A read-only file descriptor for a copy of the blob value, or {@code null}
     *         if the value is null or could not be read for some reason.
     *
     * @throws SQLiteDoneException if the query returns zero rows
     */
    public ParcelFileDescriptor simpleQueryForBlobFileDescriptor() {
        acquireReference();
        try {
            return getSession().executeForBlobFileDescriptor(
                    getSql(), getBindArgs(), getConnectionFlags(), null);
        } catch (SQLiteDatabaseCorruptException ex) {
            onCorruption();
            throw ex;
        } finally {
            releaseReference();
        }
    }

    @Override
    public String toString() {
        return "SQLiteProgram: " + getSql();
    }
}
