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

package io.requery.android.database;

import android.content.ContentResolver;
import android.database.CharArrayBuffer;
import android.database.ContentObservable;
import android.database.ContentObserver;
import android.database.Cursor;
import android.database.CursorIndexOutOfBoundsException;
import android.database.DataSetObservable;
import android.database.DataSetObserver;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import java.lang.ref.WeakReference;

/**
 * This is an abstract cursor class that handles a lot of the common code
 * that all cursors need to deal with and is provided for convenience reasons.
 */
public abstract class AbstractCursor implements Cursor {

    private static final String TAG = "Cursor";

    protected int mPos;

    protected boolean mClosed;

    //@Deprecated // deprecated in AOSP but still used for non-deprecated methods
    protected ContentResolver mContentResolver;

    private Uri mNotifyUri;

    private final Object mSelfObserverLock = new Object();
    private ContentObserver mSelfObserver;
    private boolean mSelfObserverRegistered;
    private final DataSetObservable mDataSetObservable = new DataSetObservable();
    private final ContentObservable mContentObservable = new ContentObservable();

    private Bundle mExtras = Bundle.EMPTY;

    @Override
    abstract public int getCount();

    @Override
    abstract public String[] getColumnNames();

    @Override
    abstract public String getString(int column);
    @Override
    abstract public short getShort(int column);
    @Override
    abstract public int getInt(int column);
    @Override
    abstract public long getLong(int column);
    @Override
    abstract public float getFloat(int column);
    @Override
    abstract public double getDouble(int column);
    @Override
    abstract public boolean isNull(int column);

    @Override
    public abstract int getType(int column);

    @Override
    public byte[] getBlob(int column) {
        throw new UnsupportedOperationException("getBlob is not supported");
    }

    @Override
    public int getColumnCount() {
        return getColumnNames().length;
    }

    @Override
    public void deactivate() {
        onDeactivateOrClose();
    }

    /** @hide */
    protected void onDeactivateOrClose() {
        if (mSelfObserver != null) {
            mContentResolver.unregisterContentObserver(mSelfObserver);
            mSelfObserverRegistered = false;
        }
        mDataSetObservable.notifyInvalidated();
    }

    @Override
    public boolean requery() {
        if (mSelfObserver != null && !mSelfObserverRegistered) {
            mContentResolver.registerContentObserver(mNotifyUri, true, mSelfObserver);
            mSelfObserverRegistered = true;
        }
        mDataSetObservable.notifyChanged();
        return true;
    }

    @Override
    public boolean isClosed() {
        return mClosed;
    }

    @Override
    public void close() {
        mClosed = true;
        mContentObservable.unregisterAll();
        onDeactivateOrClose();
    }

    @Override
    public void copyStringToBuffer(int columnIndex, CharArrayBuffer buffer) {
        // Default implementation, uses getString
        String result = getString(columnIndex);
        if (result != null) {
            char[] data = buffer.data;
            if (data == null || data.length < result.length()) {
                buffer.data = result.toCharArray();
            } else {
                result.getChars(0, result.length(), data, 0);
            }
            buffer.sizeCopied = result.length();
        } else {
            buffer.sizeCopied = 0;
        }
    }

    public AbstractCursor() {
        mPos = -1;
    }

    @Override
    public final int getPosition() {
        return mPos;
    }

    @Override
    public final boolean moveToPosition(int position) {
        // Make sure position isn't past the end of the cursor
        final int count = getCount();
        if (position >= count) {
            mPos = count;
            return false;
        }

        // Make sure position isn't before the beginning of the cursor
        if (position < 0) {
            mPos = -1;
            return false;
        }

        // Check for no-op moves, and skip the rest of the work for them
        if (position == mPos) {
            return true;
        }

        boolean result = onMove(mPos, position);
        if (!result) {
            mPos = -1;
        } else {
            mPos = position;
        }

        return result;
    }

    /**
     * This function is called every time the cursor is successfully scrolled
     * to a new position, giving the subclass a chance to update any state it
     * may have.  If it returns false the move function will also do so and the
     * cursor will scroll to the beforeFirst position.
     * <p>
     * This function should be called by methods such as {@link #moveToPosition(int)},
     * so it will typically not be called from outside of the cursor class itself.
     * </p>
     *
     * @param oldPosition The position that we're moving from.
     * @param newPosition The position that we're moving to.
     * @return True if the move is successful, false otherwise.
     */
    public abstract boolean onMove(int oldPosition, int newPosition);

    @Override
    public final boolean move(int offset) {
        return moveToPosition(mPos + offset);
    }

    @Override
    public final boolean moveToFirst() {
        return moveToPosition(0);
    }

    @Override
    public final boolean moveToLast() {
        return moveToPosition(getCount() - 1);
    }

    @Override
    public final boolean moveToNext() {
        return moveToPosition(mPos + 1);
    }

    @Override
    public final boolean moveToPrevious() {
        return moveToPosition(mPos - 1);
    }

    @Override
    public final boolean isFirst() {
        return mPos == 0 && getCount() != 0;
    }

    @Override
    public final boolean isLast() {
        int cnt = getCount();
        return mPos == (cnt - 1) && cnt != 0;
    }

    @Override
    public final boolean isBeforeFirst() {
        return getCount() == 0 || mPos == -1;
    }

    @Override
    public final boolean isAfterLast() {
        return getCount() == 0 || mPos == getCount();
    }

    @Override
    public int getColumnIndex(String columnName) {
        // Hack according to bug 903852
        final int periodIndex = columnName.lastIndexOf('.');
        if (periodIndex != -1) {
            Exception e = new Exception();
            Log.e(TAG, "requesting column name with table name -- " + columnName, e);
            columnName = columnName.substring(periodIndex + 1);
        }

        String columnNames[] = getColumnNames();
        int length = columnNames.length;
        for (int i = 0; i < length; i++) {
            if (columnNames[i].equalsIgnoreCase(columnName)) {
                return i;
            }
        }
        return -1;
    }

    @Override
    public int getColumnIndexOrThrow(String columnName) {
        final int index = getColumnIndex(columnName);
        if (index < 0) {
            throw new IllegalArgumentException("column '" + columnName + "' does not exist");
        }
        return index;
    }

    @Override
    public String getColumnName(int columnIndex) {
        return getColumnNames()[columnIndex];
    }

    @Override
    public void registerContentObserver(ContentObserver observer) {
        mContentObservable.registerObserver(observer);
    }

    @Override
    public void unregisterContentObserver(ContentObserver observer) {
        // cursor will unregister all observers when it close
        if (!mClosed) {
            mContentObservable.unregisterObserver(observer);
        }
    }

    @Override
    public void registerDataSetObserver(DataSetObserver observer) {
        mDataSetObservable.registerObserver(observer);
    }

    @Override
    public void unregisterDataSetObserver(DataSetObserver observer) {
        mDataSetObservable.unregisterObserver(observer);
    }

    /**
     * Subclasses must call this method when they finish committing updates to notify all
     * observers.
     *
     * @param selfChange value
     */
    @SuppressWarnings("deprecation")
    protected void onChange(boolean selfChange) {
        synchronized (mSelfObserverLock) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
                mContentObservable.dispatchChange(selfChange, null);
            } else {
                mContentObservable.dispatchChange(selfChange);
            }
            if (mNotifyUri != null && selfChange) {
                mContentResolver.notifyChange(mNotifyUri, mSelfObserver);
            }
        }
    }

    /**
     * Specifies a content URI to watch for changes.
     *
     * @param cr The content resolver from the caller's context.
     * @param notifyUri The URI to watch for changes. This can be a
     * specific row URI, or a base URI for a whole class of content.
     */
    @Override
    public void setNotificationUri(ContentResolver cr, Uri notifyUri) {
        synchronized (mSelfObserverLock) {
            mNotifyUri = notifyUri;
            mContentResolver = cr;
            if (mSelfObserver != null) {
                mContentResolver.unregisterContentObserver(mSelfObserver);
            }
            mSelfObserver = new  SelfContentObserver(this);
            mContentResolver.registerContentObserver(mNotifyUri, true, mSelfObserver);
            mSelfObserverRegistered = true;
        }
    }

    @Override
    public Uri getNotificationUri() {
        synchronized (mSelfObserverLock) {
            return mNotifyUri;
        }
    }

    @Override
    public boolean getWantsAllOnMoveCalls() {
        return false;
    }

    @Override
    public void setExtras(Bundle extras) {
        mExtras = (extras == null) ? Bundle.EMPTY : extras;
    }

    @Override
    public Bundle getExtras() {
        return mExtras;
    }

    @Override
    public Bundle respond(Bundle extras) {
        return Bundle.EMPTY;
    }

    /**
     * This function throws CursorIndexOutOfBoundsException if the cursor position is out of bounds.
     * Subclass implementations of the get functions should call this before attempting to
     * retrieve data.
     *
     * @throws CursorIndexOutOfBoundsException
     */
    protected void checkPosition() {
        if (-1 == mPos || getCount() == mPos) {
            throw new CursorIndexOutOfBoundsException(mPos, getCount());
        }
    }

    @SuppressWarnings("FinalizeDoesntCallSuperFinalize")
    @Override
    protected void finalize() {
        if (mSelfObserver != null && mSelfObserverRegistered) {
            mContentResolver.unregisterContentObserver(mSelfObserver);
        }
        try {
            if (!mClosed) close();
        } catch(Exception ignored) { }
    }

    /**
     * Cursors use this class to track changes others make to their URI.
     */
    protected static class SelfContentObserver extends ContentObserver {
        WeakReference<AbstractCursor> mCursor;

        public SelfContentObserver(AbstractCursor cursor) {
            super(null);
            mCursor = new WeakReference<>(cursor);
        }

        @Override
        public boolean deliverSelfNotifications() {
            return false;
        }

        @Override
        public void onChange(boolean selfChange) {
            AbstractCursor cursor = mCursor.get();
            if (cursor != null) {
                cursor.onChange(false);
            }
        }
    }
}
