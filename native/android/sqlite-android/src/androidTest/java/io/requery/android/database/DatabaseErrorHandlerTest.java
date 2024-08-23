/*
 * Copyright (C) 2010 The Android Open Source Project
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
import android.database.sqlite.SQLiteDiskIOException;
import android.database.sqlite.SQLiteException;
import android.util.Log;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.filters.Suppress;
import io.requery.android.database.sqlite.SQLiteDatabase;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

@Suppress // https://code.google.com/p/android/issues/detail?id=125986
// not clear how this test ever worked
@SuppressWarnings("ResultOfMethodCallIgnored")
@RunWith(AndroidJUnit4.class)
public class DatabaseErrorHandlerTest {

    private SQLiteDatabase mDatabase;
    private File mDatabaseFile;
    private static final String DB_NAME = "database_test.db";
    private File dbDir;

    @Before
    public void setUp() {
        dbDir = ApplicationProvider.getApplicationContext().getDir(this.getClass().getName(), Context.MODE_PRIVATE);
        mDatabaseFile = new File(dbDir, DB_NAME);
        if (mDatabaseFile.exists()) {
            mDatabaseFile.delete();
        }
        mDatabase = SQLiteDatabase.openOrCreateDatabase(mDatabaseFile.getPath(), null,
                new MyDatabaseCorruptionHandler());
        assertNotNull(mDatabase);
    }

    @After
    public void tearDown() {
        mDatabase.close();
        mDatabaseFile.delete();
    }

    @Test
    public void testNoCorruptionCase() {
        new MyDatabaseCorruptionHandler().onCorruption(mDatabase);
        // database file should still exist
        assertTrue(mDatabaseFile.exists());
    }


    @Test
    public void testDatabaseIsCorrupt() throws IOException {
        mDatabase.execSQL("create table t (i int);");
        // write junk into the database file
        BufferedWriter writer = new BufferedWriter(new FileWriter(mDatabaseFile.getPath()));
        writer.write("blah");
        writer.close();
        assertTrue(mDatabaseFile.exists());
        // since the database file is now corrupt, doing any sql on this database connection
        // should trigger call to MyDatabaseCorruptionHandler.onCorruption
        try {
            mDatabase.execSQL("select * from t;");
            fail("expected exception");
        } catch (SQLiteDiskIOException e) {
            //
            // this test used to produce a corrupted db. but with new sqlite it instead reports
            // Disk I/O error. meh..
            // need to figure out how to cause corruption in db
            //
            // expected
            if (mDatabaseFile.exists()) {
                mDatabaseFile.delete();
            }
        } catch (SQLiteException ignored) {
            
        }
        // database file should be gone
        assertFalse(mDatabaseFile.exists());
        // after corruption handler is called, the database file should be free of
        // database corruption
        SQLiteDatabase db = SQLiteDatabase.openOrCreateDatabase(mDatabaseFile.getPath(), null,
                new MyDatabaseCorruptionHandler());
        assertTrue(db.isDatabaseIntegrityOk());
    }

    /**
     * An example implementation of {@link DatabaseErrorHandler} to demonstrate
     * database corruption handler which checks to make sure database is indeed
     * corrupt before deleting the file.
     */
    public class MyDatabaseCorruptionHandler implements DatabaseErrorHandler {
        public void onCorruption(SQLiteDatabase dbObj) {
            boolean databaseOk = dbObj.isDatabaseIntegrityOk();
            // close the database
            try {
                dbObj.close();
            } catch (SQLiteException e) {
                /* ignore */
            }
            if (databaseOk) {
                // database is just fine. no need to delete the database file
                Log.e("CorruptionHandler", "no corruption in the database: " +
                        mDatabaseFile.getPath());
            } else {
                // database is corrupt. delete the database file
                Log.e("CorruptionHandler", "deleting the database file: " +
                        mDatabaseFile.getPath());
                new File(dbDir, DB_NAME).delete();
            }
        }
    }
}