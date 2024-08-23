/*
 * Copyright (C) 2007 The Android Open Source Project
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

import android.annotation.TargetApi;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.CursorIndexOutOfBoundsException;
import android.os.Build;
import android.util.Log;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.filters.LargeTest;
import androidx.test.filters.MediumTest;
import io.requery.android.database.sqlite.SQLiteCursor;
import io.requery.android.database.sqlite.SQLiteCursorDriver;
import io.requery.android.database.sqlite.SQLiteDatabase;
import io.requery.android.database.sqlite.SQLiteQuery;

import java.io.File;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Random;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

@SuppressWarnings({"deprecation", "ResultOfMethodCallIgnored"})
@RunWith(AndroidJUnit4.class)
public class DatabaseCursorTest {

    private static final String sString1 = "this is a test";
    private static final String sString2 = "and yet another test";
    private static final String sString3 = "this string is a little longer, but still a test";

    private static final int CURRENT_DATABASE_VERSION = 42;
    private SQLiteDatabase mDatabase;
    private File mDatabaseFile;

    @Before
    public void setUp() {
        File dbDir = ApplicationProvider.getApplicationContext().getDir("tests", Context.MODE_PRIVATE);
        mDatabaseFile = new File(dbDir, "database_test.db");

        if (mDatabaseFile.exists()) {
            mDatabaseFile.delete();
        }
        mDatabase = SQLiteDatabase.openOrCreateDatabase(mDatabaseFile.getPath(), null);
        assertNotNull(mDatabase);
        mDatabase.setVersion(CURRENT_DATABASE_VERSION);
    }

    @After
    public void tearDown() {
        mDatabase.close();
        mDatabaseFile.delete();
    }

    public boolean isPerformanceOnly() {
        return false;
    }

    private void populateDefaultTable() {
        mDatabase.execSQL("CREATE TABLE test (_id INTEGER PRIMARY KEY, data TEXT);");

        mDatabase.execSQL("INSERT INTO test (data) VALUES ('" + sString1 + "');");
        mDatabase.execSQL("INSERT INTO test (data) VALUES ('" + sString2 + "');");
        mDatabase.execSQL("INSERT INTO test (data) VALUES ('" + sString3 + "');");
    }

    @TargetApi(Build.VERSION_CODES.HONEYCOMB)
    @MediumTest
    @Test
    public void testBlob() {
        // create table
        mDatabase.execSQL(
            "CREATE TABLE test (_id INTEGER PRIMARY KEY, s TEXT, d REAL, l INTEGER, b BLOB);");
        // insert blob
        Object[] args = new Object[4];
        
        byte[] blob = new byte[1000];
        byte value = 99;
        Arrays.fill(blob, value);        
        args[3] = blob;
        
        String s = "text";
        args[0] = s;
        Double d = 99.9;
        args[1] = d;
        Long l = (long)1000;
        args[2] = l;
        
        String sql = "INSERT INTO test (s, d, l, b) VALUES (?,?,?,?)";
        mDatabase.execSQL(sql, args);
        // use cursor to access blob
        Cursor c = mDatabase.query("test", null, null, null, null, null, null);        
        c.moveToNext();
        ContentValues cv = new ContentValues();
        //DatabaseUtils.cursorRowToContentValues(c, cv);
        String[] columns = c.getColumnNames();
        int length = columns.length;
        for (int i = 0; i < length; i++) {
            if (c.getType(i) == Cursor.FIELD_TYPE_BLOB) {
                cv.put(columns[i], c.getBlob(i));
            } else {
                cv.put(columns[i], c.getString(i));
            }
        }
        
        int bCol = c.getColumnIndexOrThrow("b");
        int sCol = c.getColumnIndexOrThrow("s");
        int dCol = c.getColumnIndexOrThrow("d");
        int lCol = c.getColumnIndexOrThrow("l");
        byte[] cBlob =  c.getBlob(bCol);
        assertTrue(Arrays.equals(blob, cBlob));
        assertEquals(s, c.getString(sCol));
        assertEquals(d, new Double(c.getDouble(dCol)));
        assertEquals((long)l, c.getLong(lCol));
        c.close();
    }
    
    @MediumTest
    @Test
    public void testRealColumns() {
        mDatabase.execSQL("CREATE TABLE test (_id INTEGER PRIMARY KEY, data REAL);");
        ContentValues values = new ContentValues();
        values.put("data", 42.11);
        long id = mDatabase.insert("test", "data", values);
        assertTrue(id > 0);
        Cursor c = mDatabase.rawQuery("SELECT data FROM test", null);
        assertNotNull(c);
        assertTrue(c.moveToFirst());
        assertEquals(42.11, c.getDouble(0), 0);
        c.close();
    }

    @MediumTest
    @Test
    public void testCursor1() {
        populateDefaultTable();

        Cursor c = mDatabase.query("test", null, null, null, null, null, null);

        int dataColumn = c.getColumnIndexOrThrow("data");

        // The cursor should ignore text before the last period when looking for a column. (This
        // is a temporary hack in all implementations of getColumnIndex.)
        int dataColumn2 = c.getColumnIndexOrThrow("junk.data");
        assertEquals(dataColumn, dataColumn2);

        assertSame(3, c.getCount());

        assertTrue(c.isBeforeFirst());

        try {
            c.getInt(0);
            fail("CursorIndexOutOfBoundsException expected");
        } catch (CursorIndexOutOfBoundsException ex) {
            // expected
        }

        c.moveToNext();
        assertEquals(1, c.getInt(0));

        String s = c.getString(dataColumn);
        assertEquals(sString1, s);

        c.moveToNext();
        s = c.getString(dataColumn);
        assertEquals(sString2, s);

        c.moveToNext();
        s = c.getString(dataColumn);
        assertEquals(sString3, s);

        c.moveToPosition(-1);
        c.moveToNext();
        s = c.getString(dataColumn);
        assertEquals(sString1, s);

        c.moveToPosition(2);
        s = c.getString(dataColumn);
        assertEquals(sString3, s);

        int i;

        for (c.moveToFirst(), i = 0; !c.isAfterLast(); c.moveToNext(), i++) {
            c.getInt(0);
        }

        assertEquals(3, i);

        try {
            c.getInt(0);
            fail("CursorIndexOutOfBoundsException expected");
        } catch (CursorIndexOutOfBoundsException ex) {
            // expected
        }
        c.close();
    }

    @MediumTest
    @Test
    public void testCursor2() {
        populateDefaultTable();

        Cursor c = mDatabase.query("test", null, "_id > 1000", null, null, null, null);
        assertEquals(0, c.getCount());
        assertTrue(c.isBeforeFirst());

        try {
            c.getInt(0);
            fail("CursorIndexOutOfBoundsException expected");
        } catch (CursorIndexOutOfBoundsException ex) {
            // expected
        }

        int i;
        for (c.moveToFirst(), i = 0; !c.isAfterLast(); c.moveToNext(), i++) {
            c.getInt(0);
        }
        assertEquals(0, i);
        try {
            c.getInt(0);
            fail("CursorIndexOutOfBoundsException expected");
        } catch (CursorIndexOutOfBoundsException ex) {
            // expected
        }
        c.close();
    }

    @MediumTest
    @Test
    public void testLargeField() {
        mDatabase.execSQL("CREATE TABLE test (_id INTEGER PRIMARY KEY, data TEXT);");

        StringBuilder sql = new StringBuilder(2100);
        sql.append("INSERT INTO test (data) VALUES ('");
        Random random = new Random(System.currentTimeMillis());
        StringBuilder randomString = new StringBuilder(1979);
        for (int i = 0; i < 1979; i++) {
            randomString.append((random.nextInt() & 0xf) % 10);
        }
        sql.append(randomString);
        sql.append("');");
        mDatabase.execSQL(sql.toString());

        Cursor c = mDatabase.query("test", null, null, null, null, null, null);
        assertNotNull(c);
        assertEquals(1, c.getCount());

        assertTrue(c.moveToFirst());
        assertEquals(0, c.getPosition());
        String largeString = c.getString(c.getColumnIndexOrThrow("data"));
        assertNotNull(largeString);
        assertEquals(randomString.toString(), largeString);
        c.close();
    }

    @LargeTest
    @Test
    public void testManyRowsLong() {
        mDatabase.execSQL("CREATE TABLE test (_id INTEGER PRIMARY KEY, data INT);");
        
        final int count = 36799; 
        mDatabase.execSQL("BEGIN Transaction;");
        for (int i = 0; i < count; i++) {
            mDatabase.execSQL("INSERT INTO test (data) VALUES (" + i + ");");
        }
        mDatabase.execSQL("COMMIT;");

        Cursor c = mDatabase.query("test", new String[]{"data"}, null, null, null, null, null);
        assertNotNull(c);

        int i = 0;
        while (c.moveToNext()) {
            assertEquals(i, c.getInt(0));
            i++;
        }
        assertEquals(count, i);
        assertEquals(count, c.getCount());

        Log.d("testManyRows", "count " + Integer.toString(i));
        c.close();
    }

    @LargeTest
    @Test
    public void testManyRowsTxt() {
        mDatabase.execSQL("CREATE TABLE test (_id INTEGER PRIMARY KEY, data TEXT);");
        StringBuilder sql = new StringBuilder(2100);
        sql.append("INSERT INTO test (data) VALUES ('");
        Random random = new Random(System.currentTimeMillis());
        StringBuilder randomString = new StringBuilder(1979);
        for (int i = 0; i < 1979; i++) {
            randomString.append((random.nextInt() & 0xf) % 10);
        }
        sql.append(randomString);
        sql.append("');");

        // if cursor window size changed, adjust this value too  
        final int count = 600; // more than two fillWindow needed
        mDatabase.execSQL("BEGIN Transaction;");
        for (int i = 0; i < count; i++) {
            mDatabase.execSQL(sql.toString());
        }
        mDatabase.execSQL("COMMIT;");

        Cursor c = mDatabase.query("test", new String[]{"data"}, null, null, null, null, null);
        assertNotNull(c);

        int i = 0;
        while (c.moveToNext()) {
            assertEquals(randomString.toString(), c.getString(0));
            i++;
        }
        assertEquals(count, i);
        assertEquals(count, c.getCount());
        c.close();
    }
    
    @LargeTest
    @Test
    public void testManyRowsTxtLong() {
        mDatabase.execSQL("CREATE TABLE test (_id INTEGER PRIMARY KEY, txt TEXT, data INT);");
        
        Random random = new Random(System.currentTimeMillis());
        StringBuilder randomString = new StringBuilder(1979);
        for (int i = 0; i < 1979; i++) {
            randomString.append((random.nextInt() & 0xf) % 10);
        }

        // if cursor window size changed, adjust this value too  
        final int count = 600;
        mDatabase.execSQL("BEGIN Transaction;");
        for (int i = 0; i < count; i++) {
            StringBuilder sql = new StringBuilder(2100);
            sql.append("INSERT INTO test (txt, data) VALUES ('");
            sql.append(randomString);
            sql.append("','");
            sql.append(i);
            sql.append("');");
            mDatabase.execSQL(sql.toString());
        }
        mDatabase.execSQL("COMMIT;");

        Cursor c = mDatabase.query("test", new String[]{"txt", "data"}, null, null, null, null, null);
        assertNotNull(c);

        int i = 0;
        while (c.moveToNext()) {
            assertEquals(randomString.toString(), c.getString(0));
            assertEquals(i, c.getInt(1));
            i++;
        }
        assertEquals(count, i);
        assertEquals(count, c.getCount());
        c.close();
    }
   
    @MediumTest
    @Test
    public void testRequery() {
        populateDefaultTable();

        Cursor c = mDatabase.rawQuery("SELECT * FROM test", null);
        assertNotNull(c);
        assertEquals(3, c.getCount());
        c.deactivate();
        c.requery();
        assertEquals(3, c.getCount());
        c.close();
    }

    @MediumTest
    @Test
    public void testRequeryWithSelection() {
        populateDefaultTable();

        Cursor c = mDatabase.rawQuery("SELECT data FROM test WHERE data = '" + sString1 + "'",
                null);
        assertNotNull(c);
        assertEquals(1, c.getCount());
        assertTrue(c.moveToFirst());
        assertEquals(sString1, c.getString(0));
        c.deactivate();
        c.requery();
        assertEquals(1, c.getCount());
        assertTrue(c.moveToFirst());
        assertEquals(sString1, c.getString(0));
        c.close();
    }

    @MediumTest
    @Test
    public void testRequeryWithSelectionArgs() {
        populateDefaultTable();

        Cursor c = mDatabase.rawQuery("SELECT data FROM test WHERE data = ?",
                new String[]{sString1});
        assertNotNull(c);
        assertEquals(1, c.getCount());
        assertTrue(c.moveToFirst());
        assertEquals(sString1, c.getString(0));
        c.deactivate();
        c.requery();
        assertEquals(1, c.getCount());
        assertTrue(c.moveToFirst());
        assertEquals(sString1, c.getString(0));
        c.close();
    }

    @MediumTest
    @Test
    public void testRequeryWithAlteredSelectionArgs() {
        // Test the ability of a subclass of SQLiteCursor to change its query arguments.
        populateDefaultTable();

        SQLiteDatabase.CursorFactory factory = new SQLiteDatabase.CursorFactory() {
            public Cursor newCursor(
                SQLiteDatabase db, SQLiteCursorDriver masterQuery, String editTable,
                SQLiteQuery query) {
                return new SQLiteCursor(masterQuery, editTable, query) {
                    @Override
                    public boolean requery() {
                        setSelectionArguments(new String[]{"2"});
                        return super.requery();
                    }
                };
            }
        };
        Cursor c = mDatabase.rawQueryWithFactory(
                factory, "SELECT data FROM test WHERE _id <= ?", new String[]{"1"},
                null);
        assertNotNull(c);
        assertEquals(1, c.getCount());
        assertTrue(c.moveToFirst());
        assertEquals(sString1, c.getString(0));

        // Our hacked requery() changes the query arguments in the cursor.
        c.requery();

        assertEquals(2, c.getCount());
        assertTrue(c.moveToFirst());
        assertEquals(sString1, c.getString(0));
        assertTrue(c.moveToNext());
        assertEquals(sString2, c.getString(0));

        // Test that setting query args on a deactivated cursor also works.
        c.deactivate();
        c.requery();
    }
    /**
     * sometimes CursorWindow creation fails due to non-availability of memory create
     * another CursorWindow object. One of the scenarios of its occurrence is when
     * there are too many CursorWindow objects already opened by the process.
     * This test is for that scenario.
     */
    @LargeTest
    @Test
    public void testCursorWindowFailureWhenTooManyCursorWindowsLeftOpen() {
        mDatabase.execSQL("CREATE TABLE test (_id INTEGER PRIMARY KEY, data TEXT);");
        mDatabase.execSQL("INSERT INTO test values(1, 'test');");
        int N = 1024;
        ArrayList<Cursor> cursorList = new ArrayList<>();
        // open many cursors until a failure occurs
        for (int i = 0; i < N; i++) {
            try {
                Cursor cursor = mDatabase.rawQuery("select * from test", null);
                cursor.getCount();
                cursorList.add(cursor);
            } catch (CursorWindowAllocationException e) {
                // got the exception we wanted
                break;
            } catch (Exception e) {
                fail("unexpected exception: " + e.getMessage());
                e.printStackTrace();
                break;
            }
        }
        for (Cursor c : cursorList) {
            c.close();
        }
    }
}
