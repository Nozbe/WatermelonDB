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

import android.annotation.SuppressLint;
import android.content.ContentValues;

import junit.framework.TestCase;

import io.requery.android.database.sqlite.SQLiteDatabase;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import java.io.File;
import java.util.Random;

/**
 * Database Performance Tests
 * 
 */
public class NewDatabasePerformanceTests {

    // Edit this to change the test run times.  The original is 100.
    final static int kMultiplier = 1;

    public static class PerformanceBase extends TestCase {
        protected static final int CURRENT_DATABASE_VERSION = 42;
        protected SQLiteDatabase mDatabase;
        protected File mDatabaseFile;

        @SuppressWarnings("ResultOfMethodCallIgnored")
        @SuppressLint("SdCardPath")
        @Before
        public void setUp() {
            mDatabaseFile = new File("/sdcard", "perf_database_test.db");
            if (mDatabaseFile.exists()) {
                mDatabaseFile.delete();
            }
            mDatabase =
                    SQLiteDatabase.openOrCreateDatabase(mDatabaseFile.getPath(),
                            null);
            assertTrue(mDatabase != null);
            mDatabase.setVersion(CURRENT_DATABASE_VERSION);
        }

        @SuppressWarnings("ResultOfMethodCallIgnored")
        @After
        public void tearDown() {
            mDatabase.close();
            mDatabaseFile.delete();
        }

        public String numberName(int number) {
            String result = "";

            if (number >= 1000) {
                result += numberName((number / 1000)) + " thousand";
                number = (number % 1000);

                if (number > 0) result += " ";
            }

            if (number >= 100) {
                result += ONES[(number / 100)] + " hundred";
                number = (number % 100);

                if (number > 0) result += " ";
            }

            if (number >= 20) {
                result += TENS[(number / 10)];
                number = (number % 10);

                if (number > 0) result += " ";
            }

            if (number > 0) {
                result += ONES[number];
            }

            return result;
        }
    }

    /**
     * Test 1000 inserts.
     */

    public static class Insert1000 extends PerformanceBase {
        private static final int SIZE = 10 * kMultiplier;

        private String[] statements = new String[SIZE];

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                statements[i] =
                        "INSERT INTO t1 VALUES(" + i + "," + r + ",'"
                                + numberName(r) + "')";
            }

            mDatabase
            .execSQL("CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100))");
        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase.execSQL(statements[i]);
            }
        }
    }

    /**
     * Test 1000 inserts into an indexed table.
     */

    public static class InsertIndexed1000 extends PerformanceBase {
        private static final int SIZE = 10 * kMultiplier;

        private String[] statements = new String[SIZE];

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                statements[i] =
                        "INSERT INTO t1 VALUES(" + i + "," + r + ",'"
                                + numberName(r) + "')";
            }

            mDatabase
            .execSQL("CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100))");
            mDatabase.execSQL("CREATE INDEX i1c ON t1(c)");
        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase.execSQL(statements[i]);
            }
        }
    }

    /**
     * 100 SELECTs without an index
     */

    public static class Select100 extends PerformanceBase {
        private static final int SIZE = kMultiplier;
        private static final String[] COLUMNS = {"count(*)", "avg(b)"};

        private String[] where = new String[SIZE];

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100))");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t1 VALUES(" + i + "," + r + ",'"
                        + numberName(r) + "')");
            }

            for (int i = 0; i < SIZE; i++) {
                int lower = i * 100;
                int upper = (i + 10) * 100;
                where[i] = "b >= " + lower + " AND b < " + upper;
            }
        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase
                .query("t1", COLUMNS, where[i], null, null, null, null);
            }
        }
    }

    /**
     * 100 SELECTs on a string comparison
     */

    public static class SelectStringComparison100 extends PerformanceBase {
        private static final int SIZE = kMultiplier;
        private static final String[] COLUMNS = {"count(*)", "avg(b)"};

        private String[] where = new String[SIZE];

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100))");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t1 VALUES(" + i + "," + r + ",'"
                        + numberName(r) + "')");
            }

            for (int i = 0; i < SIZE; i++) {
                where[i] = "c LIKE '" + numberName(i) + "'";
            }
        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase
                .query("t1", COLUMNS, where[i], null, null, null, null);
            }
        }
    }

    /**
     * 100 SELECTs with an index
     */

    public static class SelectIndex100 extends PerformanceBase {
        private static final int SIZE = kMultiplier;
        private static final String[] COLUMNS = {"count(*)", "avg(b)"};

        private String[] where = new String[SIZE];

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100))");
            mDatabase.execSQL("CREATE INDEX i1b ON t1(b)");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t1 VALUES(" + i + "," + r + ",'"
                        + numberName(r) + "')");
            }

            for (int i = 0; i < SIZE; i++) {
                int lower = i * 100;
                int upper = (i + 10) * 100;
                where[i] = "b >= " + lower + " AND b < " + upper;
            }
        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase
                .query("t1", COLUMNS, where[i], null, null, null, null);
            }
        }
    }

    /**
     *  INNER JOIN without an index
     */

    public static class InnerJoin100 extends PerformanceBase {
        private static final int SIZE = kMultiplier;
        private static final String[] COLUMNS = {"t1.a"};

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100))");
            mDatabase
            .execSQL("CREATE TABLE t2(a INTEGER, b INTEGER, c VARCHAR(100))");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t1 VALUES(" + i + "," + r + ",'"
                        + numberName(r) + "')");
            }

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t2 VALUES(" + i + "," + r + ",'"
                        + numberName(r) + "')");
            }
        }

        @Test
        public void testRun() {
            mDatabase.query("t1 INNER JOIN t2 ON t1.b = t2.b", COLUMNS, null,
                    null, null, null, null);
        }
    }

    /**
     *  INNER JOIN without an index on one side
     */

    public static class InnerJoinOneSide100 extends PerformanceBase {
        private static final int SIZE = kMultiplier;
        private static final String[] COLUMNS = {"t1.a"};

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100))");
            mDatabase
            .execSQL("CREATE TABLE t2(a INTEGER, b INTEGER, c VARCHAR(100))");

            mDatabase.execSQL("CREATE INDEX i1b ON t1(b)");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t1 VALUES(" + i + "," + r + ",'"
                        + numberName(r) + "')");
            }

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t2 VALUES(" + i + "," + r + ",'"
                        + numberName(r) + "')");
            }
        }

        @Test
        public void testRun() {
            mDatabase.query("t1 INNER JOIN t2 ON t1.b = t2.b", COLUMNS, null,
                    null, null, null, null);
        }
    }

    /**
     *  INNER JOIN without an index on one side
     */

    public static class InnerJoinNoIndex100 extends PerformanceBase {
        private static final int SIZE = kMultiplier;
        private static final String[] COLUMNS = {"t1.a"};

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100))");
            mDatabase
            .execSQL("CREATE TABLE t2(a INTEGER, b INTEGER, c VARCHAR(100))");

            mDatabase.execSQL("CREATE INDEX i1b ON t1(b)");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t1 VALUES(" + i + "," + r + ",'"
                        + numberName(r) + "')");
            }

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t2 VALUES(" + i + "," + r + ",'"
                        + numberName(r) + "')");
            }
        }

        @Test
        public void testRun() {
            mDatabase.query("t1 INNER JOIN t2 ON t1.c = t2.c", COLUMNS, null,
                    null, null, null, null);
        }
    }

    /**
     *  100 SELECTs with subqueries. Subquery is using an index
     */

    public static class SelectSubQIndex100 extends PerformanceBase {
        private static final int SIZE = kMultiplier;
        private static final String[] COLUMNS = {"t1.a"};

        private String[] where = new String[SIZE];

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100))");
            mDatabase
            .execSQL("CREATE TABLE t2(a INTEGER, b INTEGER, c VARCHAR(100))");

            mDatabase.execSQL("CREATE INDEX i2b ON t2(b)");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t1 VALUES(" + i + "," + r + ",'"
                        + numberName(r) + "')");
            }

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t2 VALUES(" + i + "," + r + ",'"
                        + numberName(r) + "')");
            }

            for (int i = 0; i < SIZE; i++) {
                int lower = i * 100;
                int upper = (i + 10) * 100;
                where[i] =
                        "t1.b IN (SELECT t2.b FROM t2 WHERE t2.b >= " + lower
                        + " AND t2.b < " + upper + ")";
            }
        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase
                .query("t1", COLUMNS, where[i], null, null, null, null);
            }
        }
    }

    /**
     *  100 SELECTs on string comparison with Index
     */

    public static class SelectIndexStringComparison100 extends PerformanceBase {
        private static final int SIZE = kMultiplier;
        private static final String[] COLUMNS = {"count(*)", "avg(b)"};

        private String[] where = new String[SIZE];

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100))");
            mDatabase.execSQL("CREATE INDEX i3c ON t1(c)");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t1 VALUES(" + i + "," + r + ",'"
                        + numberName(r) + "')");
            }

            for (int i = 0; i < SIZE; i++) {
                where[i] = "c LIKE '" + numberName(i) + "'";
            }
        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase
                .query("t1", COLUMNS, where[i], null, null, null, null);
            }
        }
    }

    /**
     *  100 SELECTs on integer
     */

    public static class SelectInteger100 extends PerformanceBase {
        private static final int SIZE = kMultiplier;
        private static final String[] COLUMNS = {"b"};

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100))");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t1 VALUES(" + i + "," + r + ",'"
                        + numberName(r) + "')");
            }

        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase.query("t1", COLUMNS, null, null, null, null, null);
            }
        }
    }

    /**
     *  100 SELECTs on String
     */

    public static class SelectString100 extends PerformanceBase {
        private static final int SIZE = kMultiplier;
        private static final String[] COLUMNS = {"c"};

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100))");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t1 VALUES(" + i + "," + r + ",'"
                        + numberName(r) + "')");
            }

        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase.query("t1", COLUMNS, null, null, null, null, null);
            }
        }
    }

    /**
     *  100 SELECTs on integer with index
     */

    public static class SelectIntegerIndex100 extends PerformanceBase {
        private static final int SIZE = kMultiplier;
        private static final String[] COLUMNS = {"b"};

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100))");
            mDatabase.execSQL("CREATE INDEX i1b on t1(b)");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t1 VALUES(" + i + "," + r + ",'"
                        + numberName(r) + "')");
            }

        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase.query("t1", COLUMNS, null, null, null, null, null);
            }
        }
    }

    /**
     *  100 SELECTs on String with index
     */

    public static class SelectIndexString100 extends PerformanceBase {
        private static final int SIZE = kMultiplier;
        private static final String[] COLUMNS = {"c"};

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100))");
            mDatabase.execSQL("CREATE INDEX i1c ON t1(c)");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t1 VALUES(" + i + "," + r + ",'"
                        + numberName(r) + "')");
            }

        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase.query("t1", COLUMNS, null, null, null, null, null);
            }
        }
    }

    /**
     *  100 SELECTs on String with starts with
     */

    public static class SelectStringStartsWith100 extends PerformanceBase {
        private static final int SIZE = kMultiplier;
        private static final String[] COLUMNS = {"c"};
        private String[] where = new String[SIZE];

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100))");
            mDatabase.execSQL("CREATE INDEX i1c ON t1(c)");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t1 VALUES(" + i + "," + r + ",'"
                        + numberName(r) + "')");
            }

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                where[i] = "c LIKE '" + numberName(r).substring(0, 1) + "*'";

            }

        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase
                .query("t1", COLUMNS, where[i], null, null, null, null);
            }
        }
    }

    /**
     *  1000 Deletes on an indexed table
     */

    public static class DeleteIndexed1000 extends PerformanceBase {
        private static final int SIZE = 10 * kMultiplier;

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100))");
            mDatabase.execSQL("CREATE INDEX i3c ON t1(c)");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t1 VALUES(" + i + "," + r + ",'"
                        + numberName(r) + "')");
            }

        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase.delete("t1", null, null);
            }
        }
    }

    /**
     *  1000 Deletes
     */

    public static class Delete1000 extends PerformanceBase {
        private static final int SIZE = 10 * kMultiplier;

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100))");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t1 VALUES(" + i + "," + r + ",'"
                        + numberName(r) + "')");
            }

        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase.delete("t1", null, null);
            }
        }
    }

    /**
     *  1000 DELETE's without an index with where clause
     */

    public static class DeleteWhere1000 extends PerformanceBase {
        private static final int SIZE = 10 * kMultiplier;
        private String[] where = new String[SIZE];

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100))");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t1 VALUES(" + i + "," + r + ",'"
                        + numberName(r) + "')");
            }

            for (int i = 0; i < SIZE; i++) {
                int lower = i * 100;
                int upper = (i + 10) * 100;
                where[i] = "b >= " + lower + " AND b < " + upper;
            }
        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase.delete("t1", where[i], null);
            }
        }
    }

    /**
     *  1000 DELETE's with an index with where clause
     */

    public static class DeleteIndexWhere1000 extends PerformanceBase {
        private static final int SIZE = 10 * kMultiplier;
        private String[] where = new String[SIZE];

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100))");
            mDatabase.execSQL("CREATE INDEX i1b ON t1(b)");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t1 VALUES(" + i + "," + r + ",'"
                        + numberName(r) + "')");
            }

            for (int i = 0; i < SIZE; i++) {
                int lower = i * 100;
                int upper = (i + 10) * 100;
                where[i] = "b >= " + lower + " AND b < " + upper;
            }
        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase.delete("t1", where[i], null);
            }
        }
    }

    /**
     *  1000 update's with an index with where clause
     */

    public static class UpdateIndexWhere1000 extends PerformanceBase {
        private static final int SIZE = 10 * kMultiplier;
        private String[] where = new String[SIZE];
        ContentValues[] mValues = new ContentValues[SIZE];

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100))");
            mDatabase.execSQL("CREATE INDEX i1b ON t1(b)");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t1 VALUES(" + i + "," + r + ",'"
                        + numberName(r) + "')");
            }

            for (int i = 0; i < SIZE; i++) {

                int lower = i * 100;
                int upper = (i + 10) * 100;
                where[i] = "b >= " + lower + " AND b < " + upper;
                ContentValues b = new ContentValues(1);
                b.put("b", upper);
                mValues[i] = b;

            }
        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase.update("t1", mValues[i], where[i], null);
            }
        }
    }

    /**
     *  1000 update's without an index with where clause
     */

    public static class UpdateWhere1000 extends PerformanceBase {
        private static final int SIZE = 10 * kMultiplier;
        private String[] where = new String[SIZE];
        ContentValues[] mValues = new ContentValues[SIZE];

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t1(a INTEGER, b INTEGER, c VARCHAR(100))");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t1 VALUES(" + i + "," + r + ",'"
                        + numberName(r) + "')");
            }

            for (int i = 0; i < SIZE; i++) {

                int lower = i * 100;
                int upper = (i + 10) * 100;
                where[i] = "b >= " + lower + " AND b < " + upper;
                ContentValues b = new ContentValues(1);
                b.put("b", upper);
                mValues[i] = b;
            }
        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase.update("t1", mValues[i], where[i], null);
            }
        }
    }

    /**
     *  10000 inserts for an integer
     */

    public static class InsertInteger10000 extends PerformanceBase {
        private static final int SIZE = 100 * kMultiplier;
        ContentValues[] mValues = new ContentValues[SIZE];

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t1(a INTEGER)");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                ContentValues b = new ContentValues(1);
                b.put("a", r);
                mValues[i] = b;
            }
        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase.insert("t1", null, mValues[i]);
            }
        }
    }

    /**
     *  10000 inserts for an integer -indexed table
     */

    public static class InsertIntegerIndex10000 extends PerformanceBase {
        private static final int SIZE = 100 * kMultiplier;
        ContentValues[] mValues = new ContentValues[SIZE];

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t1(a INTEGER)");
            mDatabase.execSQL("CREATE INDEX i1a ON t1(a)");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                ContentValues b = new ContentValues(1);
                b.put("a", r);
                mValues[i] = b;
            }
        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase.insert("t1", null, mValues[i]);
            }
        }
    }

    /**
     *  10000 inserts for a String
     */

    public static class InsertString10000 extends PerformanceBase {
        private static final int SIZE = 100 * kMultiplier;
        ContentValues[] mValues = new ContentValues[SIZE];

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t1(a VARCHAR(100))");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                ContentValues b = new ContentValues(1);
                b.put("a", numberName(r));
                mValues[i] = b;
            }
        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase.insert("t1", null, mValues[i]);
            }
        }
    }

    /**
     *  10000 inserts for a String - indexed table
     */

    public static class InsertStringIndexed10000 extends PerformanceBase {
        private static final int SIZE = 100 * kMultiplier;
        ContentValues[] mValues = new ContentValues[SIZE];

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t1(a VARCHAR(100))");
            mDatabase.execSQL("CREATE INDEX i1a ON t1(a)");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                ContentValues b = new ContentValues(1);
                b.put("a", numberName(r));
                mValues[i] = b;
            }
        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase.insert("t1", null, mValues[i]);
            }
        }
    }


    /**
     *  10000 selects for a String -starts with
     */

    public static class SelectStringStartsWith10000 extends PerformanceBase {
        private static final int SIZE = 100 * kMultiplier;
        private static final String[] COLUMNS = {"t3.a"};
        private String[] where = new String[SIZE];

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t3(a VARCHAR(100))");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t3 VALUES('"
                        + numberName(r) + "')");
            }

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                where[i] = "a LIKE '" + numberName(r).substring(0, 1) + "*'";

            }
        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase.query("t3", COLUMNS, where[i], null, null, null, null);
            }
        }
    }

    /**
     *  10000 selects for a String - indexed table -starts with
     */

    public static class SelectStringIndexedStartsWith10000 extends
    PerformanceBase {
        private static final int SIZE = 100 * kMultiplier;
        private static final String[] COLUMNS = {"t3.a"};
        private String[] where = new String[SIZE];

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t3(a VARCHAR(100))");
            mDatabase.execSQL("CREATE INDEX i3a ON t3(a)");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t3 VALUES('"
                        + numberName(r) + "')");
            }

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                where[i] = "a LIKE '" + numberName(r).substring(0, 1) + "*'";

            }
        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase.query("t3", COLUMNS, where[i], null, null, null, null);
            }
        }
    }

    /**
     *  10000 selects for an integer -
     */

    public static class SelectInteger10000 extends PerformanceBase {
        private static final int SIZE = 100 * kMultiplier;
        private static final String[] COLUMNS = {"t4.a"};
        private String[] where = new String[SIZE];

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t4(a INTEGER)");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t4 VALUES(" + r + ")");
                int lower = i * 100;
                int upper = (i + 10) * 100;
                where[i] = "a >= " + lower + " AND a < " + upper;
            }
        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase.query("t4", COLUMNS, where[i], null, null, null, null);
            }
        }
    }

    /**
     *  10000 selects for an integer -indexed table
     */

    public static class SelectIntegerIndexed10000 extends PerformanceBase {
        private static final int SIZE = 100 * kMultiplier;
        private static final String[] COLUMNS = {"t4.a"};
        private String[] where = new String[SIZE];

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t4(a INTEGER)");
            mDatabase.execSQL("CREATE INDEX i4a ON t4(a)");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t4 VALUES(" + r + ")");

                int lower = i * 100;
                int upper = (i + 10) * 100;
                where[i] = "a >= " + lower + " AND a < " + upper;
            }

        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase.query("t4", COLUMNS, where[i], null, null, null, null);
            }
        }
    }


    /**
     *  10000 selects for a String - contains 'e'
     */

    public static class SelectStringContains10000 extends PerformanceBase {
        private static final int SIZE = 100 * kMultiplier;
        private static final String[] COLUMNS = {"t3.a"};
        private String[] where = new String[SIZE];

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t3(a VARCHAR(100))");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t3 VALUES('"
                        + numberName(r) + "')");
            }

            for (int i = 0; i < SIZE; i++) {
                where[i] = "a LIKE '*e*'";

            }
        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase.query("t3", COLUMNS, where[i], null, null, null, null);
            }
        }
    }

    /**
     *  10000 selects for a String - contains 'e'-indexed table
     */

    public static class SelectStringIndexedContains10000 extends
    PerformanceBase {
        private static final int SIZE = 100 * kMultiplier;
        private static final String[] COLUMNS = {"t3.a"};
        private String[] where = new String[SIZE];

        @Before
        public void setUp() {
            super.setUp();
            Random random = new Random(42);

            mDatabase
            .execSQL("CREATE TABLE t3(a VARCHAR(100))");
            mDatabase.execSQL("CREATE INDEX i3a ON t3(a)");

            for (int i = 0; i < SIZE; i++) {
                int r = random.nextInt(100000);
                mDatabase.execSQL("INSERT INTO t3 VALUES('"
                        + numberName(r) + "')");
            }

            for (int i = 0; i < SIZE; i++) {
                where[i] = "a LIKE '*e*'";

            }
        }

        @Test
        public void testRun() {
            for (int i = 0; i < SIZE; i++) {
                mDatabase.query("t3", COLUMNS, where[i], null, null, null, null);
            }
        }
    }

    public static final String[] ONES =
        {"zero", "one", "two", "three", "four", "five", "six", "seven",
        "eight", "nine", "ten", "eleven", "twelve", "thirteen",
        "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
        "nineteen"};

    public static final String[] TENS =
        {"", "ten", "twenty", "thirty", "forty", "fifty", "sixty",
        "seventy", "eighty", "ninety"};
}
