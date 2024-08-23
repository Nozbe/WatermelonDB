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

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteConstraintException;
import android.database.sqlite.SQLiteDoneException;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.filters.MediumTest;
import io.requery.android.database.sqlite.SQLiteDatabase;
import io.requery.android.database.sqlite.SQLiteStatement;

import java.io.File;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

@SuppressWarnings("ResultOfMethodCallIgnored")
@RunWith(AndroidJUnit4.class)
public class DatabaseStatementTest {

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

    @MediumTest
    @Test
    public void testExecuteStatement() {
        populateDefaultTable();
        SQLiteStatement statement = mDatabase.compileStatement("DELETE FROM test");
        statement.execute();

        Cursor c = mDatabase.query("test", null, null, null, null, null, null);
        assertEquals(0, c.getCount());
        c.close();
        statement.close();
    }

    @MediumTest
    @Test
    public void testSimpleQuery() {
        mDatabase.execSQL("CREATE TABLE test (num INTEGER NOT NULL, str TEXT NOT NULL);");
        mDatabase.execSQL("INSERT INTO test VALUES (1234, 'hello');");
        SQLiteStatement statement1 =
                mDatabase.compileStatement("SELECT num FROM test WHERE str = ?");
        SQLiteStatement statement2 =
                mDatabase.compileStatement("SELECT str FROM test WHERE num = ?");

        try {
            statement1.bindString(1, "hello");
            long value = statement1.simpleQueryForLong();
            assertEquals(1234, value);

            statement1.bindString(1, "world");
            statement1.simpleQueryForLong();
            fail("shouldn't get here");
        } catch (SQLiteDoneException e) {
            // expected
        }

        try {
            statement2.bindLong(1, 1234);
            String value = statement1.simpleQueryForString();
            assertEquals("hello", value);

            statement2.bindLong(1, 5678);
            statement1.simpleQueryForString();
            fail("shouldn't get here");
        } catch (SQLiteDoneException e) {
            // expected
        }

        statement1.close();
        statement2.close();
    }

    @MediumTest
    @Test
    public void testStatementLongBinding() {
        mDatabase.execSQL("CREATE TABLE test (num INTEGER);");
        SQLiteStatement statement = mDatabase.compileStatement("INSERT INTO test (num) VALUES (?)");

        for (int i = 0; i < 10; i++) {
            statement.bindLong(1, i);
            statement.execute();
        }
        statement.close();

        Cursor c = mDatabase.query("test", null, null, null, null, null, null);
        int numCol = c.getColumnIndexOrThrow("num");
        c.moveToFirst();
        for (long i = 0; i < 10; i++) {
            long num = c.getLong(numCol);
            assertEquals(i, num);
            c.moveToNext();
        }
        c.close();
    }

    @MediumTest
    @Test
    public void testStatementStringBinding() {
        mDatabase.execSQL("CREATE TABLE test (num TEXT);");
        SQLiteStatement statement = mDatabase.compileStatement("INSERT INTO test (num) VALUES (?)");

        for (long i = 0; i < 10; i++) {
            statement.bindString(1, Long.toHexString(i));
            statement.execute();
        }
        statement.close();

        Cursor c = mDatabase.query("test", null, null, null, null, null, null);
        int numCol = c.getColumnIndexOrThrow("num");
        c.moveToFirst();
        for (long i = 0; i < 10; i++) {
            String num = c.getString(numCol);
            assertEquals(Long.toHexString(i), num);
            c.moveToNext();
        }
        c.close();
    }

    @MediumTest
    @Test
    public void testStatementClearBindings() {
        mDatabase.execSQL("CREATE TABLE test (num INTEGER);");
        SQLiteStatement statement = mDatabase.compileStatement("INSERT INTO test (num) VALUES (?)");

        for (long i = 0; i < 10; i++) {
            statement.bindLong(1, i);
            statement.clearBindings();
            statement.execute();
        }
        statement.close();

        Cursor c = mDatabase.query("test", null, null, null, null, null, "ROWID");
        int numCol = c.getColumnIndexOrThrow("num");
        assertTrue(c.moveToFirst());
        for (long i = 0; i < 10; i++) {
            assertTrue(c.isNull(numCol));
            c.moveToNext();
        }
        c.close();
    }

    @MediumTest
    @Test
    public void testSimpleStringBinding() {
        mDatabase.execSQL("CREATE TABLE test (num TEXT, value TEXT);");
        String statement = "INSERT INTO test (num, value) VALUES (?,?)";

        String[] args = new String[2];
        for (int i = 0; i < 2; i++) {
            args[i] = Integer.toHexString(i);
        }

        mDatabase.execSQL(statement, args);

        Cursor c = mDatabase.query("test", null, null, null, null, null, null);
        int numCol = c.getColumnIndexOrThrow("num");
        int valCol = c.getColumnIndexOrThrow("value");
        c.moveToFirst();
        String num = c.getString(numCol);
        assertEquals(Integer.toHexString(0), num);

        String val = c.getString(valCol);
        assertEquals(Integer.toHexString(1), val);
        c.close();
    }

    @MediumTest
    @Test
    public void testStatementMultipleBindings() {
        mDatabase.execSQL("CREATE TABLE test (num INTEGER, str TEXT);");
        SQLiteStatement statement =
                mDatabase.compileStatement("INSERT INTO test (num, str) VALUES (?, ?)");

        for (long i = 0; i < 10; i++) {
            statement.bindLong(1, i);
            statement.bindString(2, Long.toHexString(i));
            statement.execute();
        }
        statement.close();

        Cursor c = mDatabase.query("test", null, null, null, null, null, "ROWID");
        int numCol = c.getColumnIndexOrThrow("num");
        int strCol = c.getColumnIndexOrThrow("str");
        assertTrue(c.moveToFirst());
        for (long i = 0; i < 10; i++) {
            long num = c.getLong(numCol);
            String str = c.getString(strCol);
            assertEquals(i, num);
            assertEquals(Long.toHexString(i), str);
            c.moveToNext();
        }
        c.close();
    }

    private static class StatementTestThread extends Thread {
        private SQLiteDatabase mDatabase;
        private SQLiteStatement mStatement;

        private StatementTestThread(SQLiteDatabase db, SQLiteStatement statement) {
            super();
            mDatabase = db;
            mStatement = statement;
        }

        @Override
        public void run() {
            mDatabase.beginTransaction();
            for (long i = 0; i < 10; i++) {
                mStatement.bindLong(1, i);
                mStatement.bindString(2, Long.toHexString(i));
                mStatement.execute();
            }
            mDatabase.setTransactionSuccessful();
            mDatabase.endTransaction();

            Cursor c = mDatabase.query("test", null, null, null, null, null, "ROWID");
            int numCol = c.getColumnIndexOrThrow("num");
            int strCol = c.getColumnIndexOrThrow("str");
            assertTrue(c.moveToFirst());
            for (long i = 0; i < 10; i++) {
                long num = c.getLong(numCol);
                String str = c.getString(strCol);
                assertEquals(i, num);
                assertEquals(Long.toHexString(i), str);
                c.moveToNext();
            }
            c.close();
        }
    }

    @MediumTest
    @Test
    public void testStatementMultiThreaded() throws Exception {
        mDatabase.execSQL("CREATE TABLE test (num INTEGER, str TEXT);");
        SQLiteStatement statement =
                mDatabase.compileStatement("INSERT INTO test (num, str) VALUES (?, ?)");

        StatementTestThread thread = new StatementTestThread(mDatabase, statement);
        thread.start();
        try {
            thread.join();
        } finally {
            statement.close();
        }
    }

    @MediumTest
    @Test
    public void testStatementConstraint() {
        mDatabase.execSQL("CREATE TABLE test (num INTEGER NOT NULL);");
        SQLiteStatement statement = mDatabase.compileStatement("INSERT INTO test (num) VALUES (?)");

        // Try to insert NULL, which violates the constraint
        try {
            statement.clearBindings();
            statement.execute();
            fail("expected exception not thrown");
        } catch (SQLiteConstraintException e) {
            // expected
        }

        // Make sure the statement can still be used
        statement.bindLong(1, 1);
        statement.execute();
        statement.close();

        Cursor c = mDatabase.query("test", null, null, null, null, null, null);
        int numCol = c.getColumnIndexOrThrow("num");
        c.moveToFirst();
        long num = c.getLong(numCol);
        assertEquals(1, num);
        c.close();
    }
}
