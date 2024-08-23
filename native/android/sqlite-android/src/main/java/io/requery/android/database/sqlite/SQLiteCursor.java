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

import android.util.Log;
import android.util.SparseIntArray;
import io.requery.android.database.AbstractWindowedCursor;
import io.requery.android.database.CursorWindow;

import java.util.HashMap;

/**
 * A Cursor implementation that exposes results from a query on a {@link SQLiteDatabase}.
 *
 * SQLiteCursor is not internally synchronized so code using a SQLiteCursor from multiple
 * threads should perform its own synchronization when using the SQLiteCursor.
 */
public class SQLiteCursor extends AbstractWindowedCursor {
    static final String TAG = "SQLiteCursor";
    static final int NO_COUNT = -1;

    /** The names of the columns in the rows */
    private final String[] mColumns;

    /** The query object for the cursor */
    private final SQLiteQuery mQuery;

    /** The compiled query this cursor came from */
    private final SQLiteCursorDriver mDriver;

    /** The number of rows in the cursor */
    private int mCount = NO_COUNT;

    /** The number of rows that can fit in the cursor window, 0 if unknown */
    private int mCursorWindowCapacity;

    /** A mapping of column names to column indices, to speed up lookups */
    private SparseIntArray mColumnNameArray;
    private HashMap<String, Integer> mColumnNameMap;

    /** Used to find out where a cursor was allocated in case it never got released. */
    private final CloseGuard mCloseGuard;

    /**
     * Execute a query and provide access to its result set through a Cursor
     * interface. For a query such as: {@code SELECT name, birth, phone FROM
     * myTable WHERE ... LIMIT 1,20 ORDER BY...} the column names (name, birth,
     * phone) would be in the projection argument and everything from
     * {@code FROM} onward would be in the params argument.
     *
     * @param editTable not used, present only for compatibility with
     *                  {@link android.database.sqlite.SQLiteCursor}
     * @param query     the {@link SQLiteQuery} object associated with this cursor object.
     */
    @SuppressWarnings("unused")
    public SQLiteCursor(SQLiteCursorDriver driver, String editTable, SQLiteQuery query) {
        if (query == null) {
            throw new IllegalArgumentException("query object cannot be null");
        }
        mDriver = driver;
        mQuery = query;
        mCloseGuard = CloseGuard.get();
        mColumns = query.getColumnNames();
    }

    /**
     * Get the database that this cursor is associated with.
     * @return the SQLiteDatabase that this cursor is associated with.
     */
    public SQLiteDatabase getDatabase() {
        return mQuery.getDatabase();
    }

    @Override
    public boolean onMove(int oldPosition, int newPosition) {
        // Make sure the row at newPosition is present in the window
        if (mWindow == null || newPosition < mWindow.getStartPosition() ||
                newPosition >= (mWindow.getStartPosition() + mWindow.getNumRows())) {
            fillWindow(newPosition);
        }

        return true;
    }

    @Override
    public int getCount() {
        if (mCount == NO_COUNT) {
            fillWindow(0);
        }
        return mCount;
    }

    public static int cursorPickFillWindowStartPosition(
        int cursorPosition, int cursorWindowCapacity) {
        return Math.max(cursorPosition - cursorWindowCapacity / 3, 0);
    }

    private void fillWindow(int requiredPos) {
        clearOrCreateWindow(getDatabase().getPath());

        try {
            if (mCount == NO_COUNT) {
                int startPos = cursorPickFillWindowStartPosition(requiredPos, 0);
                mCount = mQuery.fillWindow(mWindow, startPos, requiredPos, true);
                mCursorWindowCapacity = mWindow.getNumRows();
                if (Log.isLoggable(TAG, Log.DEBUG)) {
                    Log.d(TAG, "received count(*) from native_fill_window: " + mCount);
                }
            } else {
                int startPos = cursorPickFillWindowStartPosition(requiredPos,
                        mCursorWindowCapacity);
                mQuery.fillWindow(mWindow, startPos, requiredPos, false);
            }
        } catch (RuntimeException ex) {
            // Close the cursor window if the query failed and therefore will
            // not produce any results.  This helps to avoid accidentally leaking
            // the cursor window if the client does not correctly handle exceptions
            // and fails to close the cursor.
            setWindow(null);
            throw ex;
        }
    }

    @Override
    public int getColumnIndex(String columnName) {
        // Create mColumnNameMap on demand
        if (mColumnNameArray == null && mColumnNameMap == null) {
            String[] columns = mColumns;
            int columnCount = columns.length;
            SparseIntArray map = new SparseIntArray(columnCount);
            boolean collision = false;
            for (int i = 0; i < columnCount; i++) {
                int key = columns[i].hashCode();
                // check for hashCode collision
                if (map.get(key, -1) != -1) {
                    collision = true;
                    break;
                }
                map.put(key, i);
            }

            if (collision) {
                mColumnNameMap = new HashMap<>();
                for (int i = 0; i < columnCount; i++) {
                    mColumnNameMap.put(columns[i], i);
                }
            } else {
                mColumnNameArray = map;
            }
        }

        // Hack according to bug 903852
        final int periodIndex = columnName.lastIndexOf('.');
        if (periodIndex != -1) {
            Exception e = new Exception();
            Log.e(TAG, "requesting column name with table name -- " + columnName, e);
            columnName = columnName.substring(periodIndex + 1);
        }

        if (mColumnNameMap != null) {
            Integer i = mColumnNameMap.get(columnName);
            return i == null ? -1 : i;
        } else {
            return mColumnNameArray.get(columnName.hashCode(), -1);
        }
    }

    @Override
    public String[] getColumnNames() {
        return mColumns;
    }

    @Override
    public void deactivate() {
        super.deactivate();
        mDriver.cursorDeactivated();
    }

    @Override
    public void close() {
        super.close();
        synchronized (this) {
            mQuery.close();
            mDriver.cursorClosed();
        }
    }

    @Override
    public boolean requery() {
        if (isClosed()) {
            return false;
        }

        synchronized (this) {
            if (!mQuery.getDatabase().isOpen()) {
                return false;
            }

            if (mWindow != null) {
                mWindow.clear();
            }
            mPos = -1;
            mCount = NO_COUNT;

            mDriver.cursorRequeried(this);
        }

        try {
            return super.requery();
        } catch (IllegalStateException e) {
            // for backwards compatibility, just return false
            Log.w(TAG, "requery() failed " + e.getMessage(), e);
            return false;
        }
    }

    @Override
    public void setWindow(CursorWindow window) {
        super.setWindow(window);
        mCount = NO_COUNT;
    }

    /**
     * Changes the selection arguments. The new values take effect after a call to requery().
     */
    public void setSelectionArguments(String[] selectionArgs) {
        mDriver.setBindArguments(selectionArgs);
    }

    /**
     * Release the native resources, if they haven't been released yet.
     */
    @Override
    protected void finalize() {
        try {
            // if the cursor hasn't been closed yet, close it first
            if (mWindow != null) {
                mCloseGuard.warnIfOpen();
                close();
            }
        } finally {
            super.finalize();
        }
    }
}
