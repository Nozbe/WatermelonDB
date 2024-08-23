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

import android.database.CharArrayBuffer;
import android.database.Cursor;
import android.database.sqlite.SQLiteException;
import io.requery.android.database.sqlite.SQLiteClosable;

/**
 * A buffer containing multiple cursor rows.
 */
@SuppressWarnings("unused")
public class CursorWindow extends SQLiteClosable {

    private static final int WINDOW_SIZE_KB = 2048;

    /** The cursor window size. resource xml file specifies the value in kB.
     * convert it to bytes here by multiplying with 1024.
     */
    private static final int sDefaultCursorWindowSize =
        WINDOW_SIZE_KB * 1024;
    private final int mWindowSizeBytes;

    /**
     * The native CursorWindow object pointer.  (FOR INTERNAL USE ONLY)
     */
    public long mWindowPtr;

    private int mStartPos;
    private final String mName;

    private static native long nativeCreate(String name, int cursorWindowSize);
    private static native void nativeDispose(long windowPtr);

    private static native void nativeClear(long windowPtr);

    private static native int nativeGetNumRows(long windowPtr);
    private static native boolean nativeSetNumColumns(long windowPtr, int columnNum);
    private static native boolean nativeAllocRow(long windowPtr);
    private static native void nativeFreeLastRow(long windowPtr);

    private static native int nativeGetType(long windowPtr, int row, int column);
    private static native byte[] nativeGetBlob(long windowPtr, int row, int column);
    private static native String nativeGetString(long windowPtr, int row, int column);
    private static native long nativeGetLong(long windowPtr, int row, int column);
    private static native double nativeGetDouble(long windowPtr, int row, int column);

    private static native boolean nativePutBlob(long windowPtr, byte[] value, int row, int column);
    private static native boolean nativePutString(long windowPtr, String value, int row, int column);
    private static native boolean nativePutLong(long windowPtr, long value, int row, int column);
    private static native boolean nativePutDouble(long windowPtr, double value, int row, int column);
    private static native boolean nativePutNull(long windowPtr, int row, int column);

    private static native String nativeGetName(long windowPtr);

    /**
     * Creates a new empty cursor with default cursor size (currently 2MB)
     */
    public CursorWindow(String name) {
        this(name, sDefaultCursorWindowSize);
    }


    /**
     * Creates a new empty cursor window and gives it a name.
     * <p>
     * The cursor initially has no rows or columns.  Call {@link #setNumColumns(int)} to
     * set the number of columns before adding any rows to the cursor.
     * </p>
     *
     * @param name The name of the cursor window, or null if none.
     * @param windowSizeBytes Size of cursor window in bytes.
     *
     * Note: Memory is dynamically allocated as data rows are added to
     * the window. Depending on the amount of data stored, the actual
     * amount of memory allocated can be lower than specified size,
     * but cannot exceed it. Value is a non-negative number of bytes.
     */
    public CursorWindow(String name, int windowSizeBytes) {
        /* In
         https://developer.android.com/reference/android/database/CursorWindow#CursorWindow(java.lang.String,%20long)
         windowSizeBytes is long. However windowSizeBytes is
         eventually transformed into a size_t in cpp, and I can not
         guarantee that long->size_t would be possible. I thus keep
         int. This means that we can create cursor of size up to 4GiB
         while upstream can theoretically create cursor of size up to
         16 EiB. It is probably an acceptable restriction.*/
        mStartPos = 0;
        mWindowSizeBytes = windowSizeBytes;
        mName = name != null && name.length() != 0 ? name : "<unnamed>";
        mWindowPtr = nativeCreate(mName, windowSizeBytes);
        if (mWindowPtr == 0) {
            throw new CursorWindowAllocationException("Cursor window allocation of " +
                    (windowSizeBytes / 1024) + " kb failed. ");
        }
    }

    @SuppressWarnings("ThrowFromFinallyBlock")
    @Override
    protected void finalize() throws Throwable {
        try {
            dispose();
        } finally {
            super.finalize();
        }
    }

    private void dispose() {
        if (mWindowPtr != 0) {
            nativeDispose(mWindowPtr);
            mWindowPtr = 0;
        }
    }

    /**
     * Gets the name of this cursor window, never null.
     */
    public String getName() {
        return mName;
    }

    /**
     * Clears out the existing contents of the window, making it safe to reuse
     * for new data.
     * <p>
     * The start position ({@link #getStartPosition()}), number of rows ({@link #getNumRows()}),
     * and number of columns in the cursor are all reset to zero.
     * </p>
     */
    public void clear() {
        mStartPos = 0;
        nativeClear(mWindowPtr);
    }

    /**
     * Gets the start position of this cursor window.
     * <p>
     * The start position is the zero-based index of the first row that this window contains
     * relative to the entire result set of the {@link Cursor}.
     * </p>
     *
     * @return The zero-based start position.
     */
    public int getStartPosition() {
        return mStartPos;
    }

    /**
     * Sets the start position of this cursor window.
     * <p>
     * The start position is the zero-based index of the first row that this window contains
     * relative to the entire result set of the {@link Cursor}.
     * </p>
     *
     * @param pos The new zero-based start position.
     */
    public void setStartPosition(int pos) {
        mStartPos = pos;
    }

    /**
     * Gets the number of rows in this window.
     *
     * @return The number of rows in this cursor window.
     */
    public int getNumRows() {
        return nativeGetNumRows(mWindowPtr);
    }

    /**
     * Sets the number of columns in this window.
     * <p>
     * This method must be called before any rows are added to the window, otherwise
     * it will fail to set the number of columns if it differs from the current number
     * of columns.
     * </p>
     *
     * @param columnNum The new number of columns.
     * @return True if successful.
     */
    public boolean setNumColumns(int columnNum) {
        return nativeSetNumColumns(mWindowPtr, columnNum);
    }

    /**
     * Allocates a new row at the end of this cursor window.
     *
     * @return True if successful, false if the cursor window is out of memory.
     */
    public boolean allocRow(){
        return nativeAllocRow(mWindowPtr);
    }

    /**
     * Frees the last row in this cursor window.
     */
    public void freeLastRow(){
        nativeFreeLastRow(mWindowPtr);
    }

    /**
     * Returns the type of the field at the specified row and column index.
     * <p>
     * The returned field types are:
     * <ul>
     * <li>{@link Cursor#FIELD_TYPE_NULL}</li>
     * <li>{@link Cursor#FIELD_TYPE_INTEGER}</li>
     * <li>{@link Cursor#FIELD_TYPE_FLOAT}</li>
     * <li>{@link Cursor#FIELD_TYPE_STRING}</li>
     * <li>{@link Cursor#FIELD_TYPE_BLOB}</li>
     * </ul>
     * </p>
     *
     * @param row The zero-based row index.
     * @param column The zero-based column index.
     * @return The field type.
     */
    public int getType(int row, int column) {
        return nativeGetType(mWindowPtr, row - mStartPos, column);
    }

    /**
     * Gets the value of the field at the specified row and column index as a byte array.
     * <p>
     * The result is determined as follows:
     * <ul>
     * <li>If the field is of type {@link Cursor#FIELD_TYPE_NULL}, then the result
     * is <code>null</code>.</li>
     * <li>If the field is of type {@link Cursor#FIELD_TYPE_BLOB}, then the result
     * is the blob value.</li>
     * <li>If the field is of type {@link Cursor#FIELD_TYPE_STRING}, then the result
     * is the array of bytes that make up the internal representation of the
     * string value.</li>
     * <li>If the field is of type {@link Cursor#FIELD_TYPE_INTEGER} or
     * {@link Cursor#FIELD_TYPE_FLOAT}, then a {@link SQLiteException} is thrown.</li>
     * </ul>
     * </p>
     *
     * @param row The zero-based row index.
     * @param column The zero-based column index.
     * @return The value of the field as a byte array.
     */
    public byte[] getBlob(int row, int column) {
        return nativeGetBlob(mWindowPtr, row - mStartPos, column);
    }

    /**
     * Gets the value of the field at the specified row and column index as a string.
     * <p>
     * The result is determined as follows:
     * <ul>
     * <li>If the field is of type {@link Cursor#FIELD_TYPE_NULL}, then the result
     * is <code>null</code>.</li>
     * <li>If the field is of type {@link Cursor#FIELD_TYPE_STRING}, then the result
     * is the string value.</li>
     * <li>If the field is of type {@link Cursor#FIELD_TYPE_INTEGER}, then the result
     * is a string representation of the integer in decimal, obtained by formatting the
     * value with the <code>printf</code> family of functions using
     * format specifier <code>%lld</code>.</li>
     * <li>If the field is of type {@link Cursor#FIELD_TYPE_FLOAT}, then the result
     * is a string representation of the floating-point value in decimal, obtained by
     * formatting the value with the <code>printf</code> family of functions using
     * format specifier <code>%g</code>.</li>
     * <li>If the field is of type {@link Cursor#FIELD_TYPE_BLOB}, then a
     * {@link SQLiteException} is thrown.</li>
     * </ul>
     * </p>
     *
     * @param row The zero-based row index.
     * @param column The zero-based column index.
     * @return The value of the field as a string.
     */
    public String getString(int row, int column) {
        return nativeGetString(mWindowPtr, row - mStartPos, column);
    }

    /**
     * Copies the text of the field at the specified row and column index into
     * a {@link CharArrayBuffer}.
     * <p>
     * The buffer is populated as follows:
     * <ul>
     * <li>If the buffer is too small for the value to be copied, then it is
     * automatically resized.</li>
     * <li>If the field is of type {@link Cursor#FIELD_TYPE_NULL}, then the buffer
     * is set to an empty string.</li>
     * <li>If the field is of type {@link Cursor#FIELD_TYPE_STRING}, then the buffer
     * is set to the contents of the string.</li>
     * <li>If the field is of type {@link Cursor#FIELD_TYPE_INTEGER}, then the buffer
     * is set to a string representation of the integer in decimal, obtained by formatting the
     * value with the <code>printf</code> family of functions using
     * format specifier <code>%lld</code>.</li>
     * <li>If the field is of type {@link Cursor#FIELD_TYPE_FLOAT}, then the buffer is
     * set to a string representation of the floating-point value in decimal, obtained by
     * formatting the value with the <code>printf</code> family of functions using
     * format specifier <code>%g</code>.</li>
     * <li>If the field is of type {@link Cursor#FIELD_TYPE_BLOB}, then a
     * {@link SQLiteException} is thrown.</li>
     * </ul>
     * </p>
     *
     * @param row The zero-based row index.
     * @param column The zero-based column index.
     * @param buffer The {@link CharArrayBuffer} to hold the string.  It is automatically
     * resized if the requested string is larger than the buffer's current capacity.
      */
    public void copyStringToBuffer(int row, int column, CharArrayBuffer buffer) {
        if (buffer == null) {
            throw new IllegalArgumentException("CharArrayBuffer should not be null");
        }
        // TODO not as optimal as the original code
        char[] chars = getString(row, column).toCharArray();
        buffer.data = chars;
        buffer.sizeCopied = chars.length;
    }

    /**
     * Gets the value of the field at the specified row and column index as a <code>long</code>.
     * <p>
     * The result is determined as follows:
     * <ul>
     * <li>If the field is of type {@link Cursor#FIELD_TYPE_NULL}, then the result
     * is <code>0L</code>.</li>
     * <li>If the field is of type {@link Cursor#FIELD_TYPE_STRING}, then the result
     * is the value obtained by parsing the string value with <code>strtoll</code>.
     * <li>If the field is of type {@link Cursor#FIELD_TYPE_INTEGER}, then the result
     * is the <code>long</code> value.</li>
     * <li>If the field is of type {@link Cursor#FIELD_TYPE_FLOAT}, then the result
     * is the floating-point value converted to a <code>long</code>.</li>
     * <li>If the field is of type {@link Cursor#FIELD_TYPE_BLOB}, then a
     * {@link SQLiteException} is thrown.</li>
     * </ul>
     * </p>
     *
     * @param row The zero-based row index.
     * @param column The zero-based column index.
     * @return The value of the field as a <code>long</code>.
     */
    public long getLong(int row, int column) {
        return nativeGetLong(mWindowPtr, row - mStartPos, column);
    }

    /**
     * Gets the value of the field at the specified row and column index as a
     * <code>double</code>.
     * <p>
     * The result is determined as follows:
     * <ul>
     * <li>If the field is of type {@link Cursor#FIELD_TYPE_NULL}, then the result
     * is <code>0.0</code>.</li>
     * <li>If the field is of type {@link Cursor#FIELD_TYPE_STRING}, then the result
     * is the value obtained by parsing the string value with <code>strtod</code>.
     * <li>If the field is of type {@link Cursor#FIELD_TYPE_INTEGER}, then the result
     * is the integer value converted to a <code>double</code>.</li>
     * <li>If the field is of type {@link Cursor#FIELD_TYPE_FLOAT}, then the result
     * is the <code>double</code> value.</li>
     * <li>If the field is of type {@link Cursor#FIELD_TYPE_BLOB}, then a
     * {@link SQLiteException} is thrown.</li>
     * </ul>
     * </p>
     *
     * @param row The zero-based row index.
     * @param column The zero-based column index.
     * @return The value of the field as a <code>double</code>.
     */
    public double getDouble(int row, int column) {
        return nativeGetDouble(mWindowPtr, row - mStartPos, column);
    }

    /**
     * Gets the value of the field at the specified row and column index as a
     * <code>short</code>.
     * <p>
     * The result is determined by invoking {@link #getLong} and converting the
     * result to <code>short</code>.
     * </p>
     *
     * @param row The zero-based row index.
     * @param column The zero-based column index.
     * @return The value of the field as a <code>short</code>.
     */
    public short getShort(int row, int column) {
        return (short) getLong(row, column);
    }

    /**
     * Gets the value of the field at the specified row and column index as an
     * <code>int</code>.
     * <p>
     * The result is determined by invoking {@link #getLong} and converting the
     * result to <code>int</code>.
     * </p>
     *
     * @param row The zero-based row index.
     * @param column The zero-based column index.
     * @return The value of the field as an <code>int</code>.
     */
    public int getInt(int row, int column) {
        return (int) getLong(row, column);
    }

    /**
     * Gets the value of the field at the specified row and column index as a
     * <code>float</code>.
     * <p>
     * The result is determined by invoking {@link #getDouble} and converting the
     * result to <code>float</code>.
     * </p>
     *
     * @param row The zero-based row index.
     * @param column The zero-based column index.
     * @return The value of the field as an <code>float</code>.
     */
    public float getFloat(int row, int column) {
        return (float) getDouble(row, column);
    }

    /**
     * Copies a byte array into the field at the specified row and column index.
     *
     * @param value The value to store.
     * @param row The zero-based row index.
     * @param column The zero-based column index.
     * @return True if successful.
     */
    public boolean putBlob(byte[] value, int row, int column) {
        return nativePutBlob(mWindowPtr, value, row - mStartPos, column);
    }

    /**
     * Copies a string into the field at the specified row and column index.
     *
     * @param value The value to store.
     * @param row The zero-based row index.
     * @param column The zero-based column index.
     * @return True if successful.
     */
    public boolean putString(String value, int row, int column) {
        return nativePutString(mWindowPtr, value, row - mStartPos, column);
    }

    /**
     * Puts a long integer into the field at the specified row and column index.
     *
     * @param value The value to store.
     * @param row The zero-based row index.
     * @param column The zero-based column index.
     * @return True if successful.
     */
    public boolean putLong(long value, int row, int column) {
        return nativePutLong(mWindowPtr, value, row - mStartPos, column);
    }

    /**
     * Puts a double-precision floating point value into the field at the
     * specified row and column index.
     *
     * @param value The value to store.
     * @param row The zero-based row index.
     * @param column The zero-based column index.
     * @return True if successful.
     */
    public boolean putDouble(double value, int row, int column) {
        return nativePutDouble(mWindowPtr, value, row - mStartPos, column);
    }

    /**
     * Puts a null value into the field at the specified row and column index.
     *
     * @param row The zero-based row index.
     * @param column The zero-based column index.
     * @return True if successful.
     */
    public boolean putNull(int row, int column) {
        return nativePutNull(mWindowPtr, row - mStartPos, column);
    }

    @Override
    protected void onAllReferencesReleased() {
        dispose();
    }

    @Override
    public String toString() {
        return getName() + " {" + Long.toHexString(mWindowPtr) + "}";
    }

    public int getWindowSizeBytes() {
        return mWindowSizeBytes;
    }
}
