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

import android.content.ContentValues;
import android.content.Context;
import android.database.CharArrayBuffer;
import android.database.Cursor;
import android.database.DatabaseUtils;
import android.database.sqlite.SQLiteException;
import android.os.Parcel;
import android.util.Log;
import android.util.Pair;

import junit.framework.Assert;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.io.File;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.filters.LargeTest;
import androidx.test.filters.MediumTest;
import androidx.test.filters.SmallTest;
import androidx.test.filters.Suppress;
import io.requery.android.database.sqlite.SQLiteDatabase;
import io.requery.android.database.sqlite.SQLiteStatement;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

@SuppressWarnings({"deprecated", "ResultOfMethodCallIgnored"})
@RunWith(AndroidJUnit4.class)
public class DatabaseGeneralTest {
    private static final String TAG = "DatabaseGeneralTest";

    private static final String sString1 = "this is a test";
    private static final String sString2 = "and yet another test";
    private static final String sString3 = "this string is a little longer, but still a test";
    private static final String PHONE_NUMBER = "16175551212";

    private static final int CURRENT_DATABASE_VERSION = 42;
    private SQLiteDatabase mDatabase;
    private File mDatabaseFile;

    @Before
    public void setUp() {
        File dbDir = ApplicationProvider.getApplicationContext().getDir(this.getClass().getName(), Context.MODE_PRIVATE);
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
    public void testCustomFunction() {
        mDatabase.addCustomFunction("roundFunction", 1, new SQLiteDatabase.CustomFunction() {
            @Override
            public String callback(String[] args) {
                String input = args[0];
                double value = Double.parseDouble(input);
                return String.valueOf(Math.round(value));
            }
        });
        Cursor cursor = mDatabase.rawQuery("SELECT roundFunction(3.14)", null);
        assertTrue(cursor.moveToFirst());
        int result = cursor.getInt(0);
        assertSame(3, result);
    }

    @MediumTest
    @Test
    public void testNewFunction() {
        mDatabase.addFunction("roundFunction2", 1, new SQLiteDatabase.Function() {
            @Override
            public void callback(Args args, Result result) {
                double value = args.getDouble(0);
                result.set(Math.round(value));
            }
        });
        Cursor cursor = mDatabase.rawQuery("SELECT roundFunction2(3.14)", null);
        assertTrue(cursor.moveToFirst());
        int result = cursor.getInt(0);
        assertSame(3, result);
    }

    @MediumTest
    @Test
    public void testCustomFunctionNoReturn() {
        mDatabase.addCustomFunction("emptyFunction", 1, new SQLiteDatabase.CustomFunction() {
            @Override
            public String callback(String[] args) {
                return null;
            }
        });
        Cursor cursor = mDatabase.rawQuery("SELECT emptyFunction(3.14)", null);
        // always empty regardless of if sqlite3_result_null is called or not
        cursor.moveToFirst();
        assertSame(null, cursor.getString(0));
    }

    @MediumTest
    @Test
    public void testNewFunctionNoReturn() {
        mDatabase.addFunction("emptyFunction2", 1, new SQLiteDatabase.Function() {
            @Override
            public void callback(Args args, Result result) {
            }
        });
        Cursor cursor = mDatabase.rawQuery("SELECT emptyFunction2(3.14)", null);
        // always empty regardless of if sqlite3_result_null is called or not
        cursor.moveToFirst();
        assertSame(null, cursor.getString(0));
    }

    @MediumTest
    @Test
    public void testSetUpdateHook() {
        // Initialize AtomicReferences with a default value
        AtomicInteger calledOperation = new AtomicInteger();
        AtomicReference<String> calledDatabaseName = new AtomicReference<>("");
        AtomicReference<String> calledTableName = new AtomicReference<>("");
        AtomicLong calledRowId = new AtomicLong();

        // Set up the update hook
        mDatabase.setUpdateHook((operationType, databaseName, tableName, rowId) -> {
            calledOperation.set(operationType);
            calledDatabaseName.set(databaseName);
            calledTableName.set(tableName);
            calledRowId.set(rowId);
        });

        // Execute SQL statements
        mDatabase.execSQL("CREATE TABLE testUpdateHook (_id INTEGER PRIMARY KEY, data TEXT);");
        mDatabase.execSQL("INSERT INTO testUpdateHook (data) VALUES ('newValue');");

        // Verify that the update hook was called correctly
        assertEquals(18, calledOperation.get());
        assertEquals("main", calledDatabaseName.get());
        assertEquals("testUpdateHook", calledTableName.get());
        assertEquals(1, calledRowId.get());
    }

    @MediumTest
    @Test
    public void testVersion() {
        assertEquals(CURRENT_DATABASE_VERSION, mDatabase.getVersion());
        mDatabase.setVersion(11);
        assertEquals(11, mDatabase.getVersion());
    }

    @MediumTest
    @Test
    public void testUpdate() {
        populateDefaultTable();

        ContentValues values = new ContentValues(1);
        values.put("data", "this is an updated test");
        assertEquals(1, mDatabase.update("test", values, "_id=1", null));
        Cursor c = mDatabase.query("test", null, "_id=1", null, null, null, null);
        assertNotNull(c);
        assertEquals(1, c.getCount());
        c.moveToFirst();
        String value = c.getString(c.getColumnIndexOrThrow("data"));
        assertEquals("this is an updated test", value);
    }

    @MediumTest
    @Test
    public void testSupportUpdate() {
        populateDefaultTable();

        ContentValues values = new ContentValues(1);
        values.put("data", "this is an updated test");
        assertEquals(1, mDatabase.update("test", SQLiteDatabase.CONFLICT_NONE, values,
                "_id=?", new Object[] { 1 }));
        Cursor c = mDatabase.query("test", null, "_id=1", null, null, null, null);
        assertNotNull(c);
        assertEquals(1, c.getCount());
        c.moveToFirst();
        String value = c.getString(c.getColumnIndexOrThrow("data"));
        assertEquals("this is an updated test", value);
    }

    @MediumTest
    @Test
    public void testSupportDelete() {
        populateDefaultTable();

        assertEquals(1, mDatabase.delete("test", "_id=?", new Object[] { 1 }));
        Cursor c = mDatabase.query("test", null, "_id=1", null, null, null, null);
        assertNotNull(c);
        assertEquals(0, c.getCount());
    }

    @Suppress // PHONE_NUMBERS_EQUAL not supported
    @MediumTest
    @Test
    public void testPhoneNumbersEqual() {
        mDatabase.execSQL("CREATE TABLE phones (num TEXT);");
        mDatabase.execSQL("INSERT INTO phones (num) VALUES ('911');");
        mDatabase.execSQL("INSERT INTO phones (num) VALUES ('5555');");
        mDatabase.execSQL("INSERT INTO phones (num) VALUES ('+" + PHONE_NUMBER + "');");

        String number;
        Cursor c;

        c = mDatabase.query("phones", null,
                "PHONE_NUMBERS_EQUAL(num, '504-555-7683')", null, null, null, null);
        assertTrue(c == null || c.getCount() == 0);
        c.close();

        c = mDatabase.query("phones", null,
                "PHONE_NUMBERS_EQUAL(num, '911')", null, null, null, null);
        assertNotNull(c);
        assertEquals(1, c.getCount());
        c.moveToFirst();
        number = c.getString(c.getColumnIndexOrThrow("num"));
        assertEquals("911", number);
        c.close();

        c = mDatabase.query("phones", null,
                "PHONE_NUMBERS_EQUAL(num, '5555')", null, null, null, null);
        assertNotNull(c);
        assertEquals(1, c.getCount());
        c.moveToFirst();
        number = c.getString(c.getColumnIndexOrThrow("num"));
        assertEquals("5555", number);
        c.close();

        c = mDatabase.query("phones", null,
                "PHONE_NUMBERS_EQUAL(num, '180055555555')", null, null, null, null);
        assertTrue(c == null || c.getCount() == 0);
        c.close();

        c = mDatabase.query("phones", null,
                "PHONE_NUMBERS_EQUAL(num, '+" + PHONE_NUMBER + "')", null, null, null, null);
        assertNotNull(c);
        assertEquals(1, c.getCount());
        c.moveToFirst();
        number = c.getString(c.getColumnIndexOrThrow("num"));
        assertEquals("+" + PHONE_NUMBER, number);
        c.close();

        c = mDatabase.query("phones", null,
                "PHONE_NUMBERS_EQUAL(num, '+1 (617).555-1212')", null, null, null, null);
        assertNotNull(c);
        assertEquals(1, c.getCount());
        c.moveToFirst();
        number = c.getString(c.getColumnIndexOrThrow("num"));
        assertEquals("+" + PHONE_NUMBER, number);
        c.close();

        c = mDatabase.query("phones", null,
                "PHONE_NUMBERS_EQUAL(num, '" + PHONE_NUMBER + "')", null, null, null, null);
        assertNotNull(c);
        assertEquals(1, c.getCount());
        c.moveToFirst();
        number = c.getString(c.getColumnIndexOrThrow("num"));
        assertEquals("+" + PHONE_NUMBER, number);
        c.close();

        /*
        c = mDatabase.query("phones", null,
                "PHONE_NUMBERS_EQUAL(num, '5551212')", null, null, null, null);
        assertNotNull(c);
        assertEquals(1, c.getCount());
        c.moveToFirst();
        number = c.getString(c.getColumnIndexOrThrow("num"));
        assertEquals("+" + PHONE_NUMBER, number);
        c.close();
        */

        c = mDatabase.query("phones", null,
                "PHONE_NUMBERS_EQUAL(num, '011" + PHONE_NUMBER + "')", null, null, null, null);
        assertNotNull(c);
        assertEquals(1, c.getCount());
        c.moveToFirst();
        number = c.getString(c.getColumnIndexOrThrow("num"));
        assertEquals("+" + PHONE_NUMBER, number);
        c.close();

        c = mDatabase.query("phones", null,
                "PHONE_NUMBERS_EQUAL(num, '00" + PHONE_NUMBER + "')", null, null, null, null);
        assertNotNull(c);
        assertEquals(1, c.getCount());
        c.moveToFirst();
        number = c.getString(c.getColumnIndexOrThrow("num"));
        assertEquals("+" + PHONE_NUMBER, number);
        c.close();
    }
    
    private void phoneNumberCompare(String phone1, String phone2, boolean equal, 
            boolean useStrictComparation) {
        String[] temporalPhoneNumbers = new String[2];
        temporalPhoneNumbers[0] = phone1;
        temporalPhoneNumbers[1] = phone2;

        Cursor cursor = mDatabase.rawQuery(
                String.format(Locale.ROOT,
                        "SELECT CASE WHEN PHONE_NUMBERS_EQUAL(?, ?, %d) " +
                        "THEN 'equal' ELSE 'not equal' END",
                        (useStrictComparation ? 1 : 0)),
                temporalPhoneNumbers);
        try {
            assertNotNull(cursor);
            assertTrue(cursor.moveToFirst());
            if (equal) {
                assertEquals(String.format("Unexpectedly, \"%s != %s\".", phone1, phone2),
                        "equal", cursor.getString(0));
            } else {
                assertEquals(String.format("Unexpectedly, \"%s\" == \"%s\".", phone1, phone2),
                        "not equal", cursor.getString(0));
            }
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }
    }

    private void assertPhoneNumberEqual(String phone1, String phone2) {
        assertPhoneNumberEqual(phone1, phone2, true);
        assertPhoneNumberEqual(phone1, phone2, false);
    }
    
    private void assertPhoneNumberEqual(String phone1, String phone2, boolean useStrict) {
        phoneNumberCompare(phone1, phone2, true, useStrict);
    }

    private void assertPhoneNumberNotEqual(String phone1, String phone2) throws Exception {
        assertPhoneNumberNotEqual(phone1, phone2, true);
        assertPhoneNumberNotEqual(phone1, phone2, false);
    }
    
    private void assertPhoneNumberNotEqual(String phone1, String phone2, boolean useStrict)
            throws Exception {
        phoneNumberCompare(phone1, phone2, false, useStrict);
    }

    /**
     * Tests international matching issues for the PHONE_NUMBERS_EQUAL function.
     * 
     * @throws Exception
     */
    @Suppress // PHONE_NUMBERS_EQUAL not supported
    @SmallTest
    @Test
    public void testPhoneNumbersEqualInternationl() throws Exception {
        assertPhoneNumberEqual("1", "1");
        assertPhoneNumberEqual("123123", "123123");
        assertPhoneNumberNotEqual("123123", "923123");
        assertPhoneNumberNotEqual("123123", "123129");
        assertPhoneNumberNotEqual("123123", "1231234");
        assertPhoneNumberNotEqual("123123", "0123123", false);
        assertPhoneNumberNotEqual("123123", "0123123", true);
        assertPhoneNumberEqual("650-253-0000", "6502530000");
        assertPhoneNumberEqual("650-253-0000", "650 253 0000");
        assertPhoneNumberEqual("650 253 0000", "6502530000");
        assertPhoneNumberEqual("+1 650-253-0000", "6502530000");
        assertPhoneNumberEqual("001 650-253-0000", "6502530000");
        assertPhoneNumberEqual("0111 650-253-0000", "6502530000");

        // Russian trunk digit
        assertPhoneNumberEqual("+79161234567", "89161234567");

        // French trunk digit
        assertPhoneNumberEqual("+33123456789", "0123456789");

        // Trunk digit for city codes in the Netherlands
        assertPhoneNumberEqual("+31771234567", "0771234567");

        // Test broken caller ID seen on call from Thailand to the US
        assertPhoneNumberEqual("+66811234567", "166811234567");

        // Test the same in-country number with different country codes
        assertPhoneNumberNotEqual("+33123456789", "+1123456789");

        // Test one number with country code and the other without
        assertPhoneNumberEqual("5125551212", "+15125551212");

        // Test two NANP numbers that only differ in the area code
        assertPhoneNumberNotEqual("5125551212", "6505551212");

        // Japanese phone numbers
        assertPhoneNumberEqual("090-1234-5678", "+819012345678");
        assertPhoneNumberEqual("090(1234)5678", "+819012345678");
        assertPhoneNumberEqual("090-1234-5678", "+81-90-1234-5678");

        // Equador
        assertPhoneNumberEqual("+593(800)123-1234", "8001231234");
        assertPhoneNumberEqual("+593-2-1234-123", "21234123");

        // Two continuous 0 at the beginning of the phone string should not be
        // treated as trunk prefix in the strict comparation.
        assertPhoneNumberEqual("008001231234", "8001231234", false);
        assertPhoneNumberNotEqual("008001231234", "8001231234", true);

        // Confirm that the bug found before does not re-appear in the strict compalation
        assertPhoneNumberEqual("080-1234-5678", "+819012345678", false);
        assertPhoneNumberNotEqual("080-1234-5678", "+819012345678", true);
    }

    @MediumTest
    @Test
    public void testCopyString() throws Exception {
        mDatabase.execSQL("CREATE TABLE guess (numi INTEGER, numf FLOAT, str TEXT);");
        mDatabase.execSQL(
                "INSERT INTO guess (numi,numf,str) VALUES (0,0.0,'ZoomZoomZoomZoom');");
        mDatabase.execSQL("INSERT INTO guess (numi,numf,str) VALUES (2000000000,3.1415926535,'');");
        String chinese = "\u4eac\u4ec5 \u5c3d\u5f84\u60ca";
        String[] arr = new String[1];
        arr[0] = chinese;
        mDatabase.execSQL("INSERT INTO guess (numi,numf,str) VALUES (-32768,-1.0,?)", arr);

        Cursor c;

        c = mDatabase.rawQuery("SELECT * FROM guess", null);
        
        c.moveToFirst();
        
        CharArrayBuffer buf = new CharArrayBuffer(14);
        
        String compareTo = c.getString(c.getColumnIndexOrThrow("numi"));
        int numiIdx = c.getColumnIndexOrThrow("numi");
        int numfIdx = c.getColumnIndexOrThrow("numf");
        int strIdx = c.getColumnIndexOrThrow("str");
        
        c.copyStringToBuffer(numiIdx, buf);
        assertEquals(1, buf.sizeCopied);
        assertEquals(compareTo, new String(buf.data, 0, buf.sizeCopied));
        
        c.copyStringToBuffer(strIdx, buf);
        assertEquals("ZoomZoomZoomZoom", new String(buf.data, 0, buf.sizeCopied));
        
        c.moveToNext();
        compareTo = c.getString(numfIdx);
        
        c.copyStringToBuffer(numfIdx, buf);
        assertEquals(compareTo, new String(buf.data, 0, buf.sizeCopied));
        c.copyStringToBuffer(strIdx, buf);
        assertEquals(0, buf.sizeCopied);
        
        c.moveToNext();
        c.copyStringToBuffer(numfIdx, buf);
        assertEquals(new Double(-1.0), Double.valueOf(
            new String(buf.data, 0, buf.sizeCopied)));
        
        c.copyStringToBuffer(strIdx, buf);
        compareTo = c.getString(strIdx);
        assertEquals(chinese, compareTo);
       
        assertEquals(chinese, new String(buf.data, 0, buf.sizeCopied));
        c.close();
    }
    
    @MediumTest
    @Test
    public void testSchemaChange1() throws Exception {
        SQLiteDatabase db1 = mDatabase;
        Cursor cursor;

        db1.execSQL("CREATE TABLE db1 (_id INTEGER PRIMARY KEY, data TEXT);");

        cursor = db1.query("db1", null, null, null, null, null, null);
        assertNotNull("Cursor is null", cursor);

        db1.execSQL("CREATE TABLE db2 (_id INTEGER PRIMARY KEY, data TEXT);");

        assertEquals(0, cursor.getCount());
        cursor.close();
    }

    @MediumTest
    @Test
    public void testSchemaChange2() {
        mDatabase.execSQL("CREATE TABLE db1 (_id INTEGER PRIMARY KEY, data TEXT);");
        Cursor cursor = mDatabase.query("db1", null, null, null, null, null, null);
        assertNotNull(cursor);
        assertEquals(0, cursor.getCount());
        cursor.close();
    }

    @MediumTest
    @Test
    public void testSchemaChange3() {
        mDatabase.execSQL("CREATE TABLE db1 (_id INTEGER PRIMARY KEY, data TEXT);");
        mDatabase.execSQL("INSERT INTO db1 (data) VALUES ('test');");
        mDatabase.execSQL("ALTER TABLE db1 ADD COLUMN blah int;");
        Cursor c = null;
        try {
            c = mDatabase.rawQuery("select blah from db1", null);
        } catch (SQLiteException e) {
            fail("unexpected exception: " + e.getMessage());
        } finally {
            if (c != null) {
                c.close();
            }
        }
    }

    @MediumTest
    @Test
    public void testSelectionArgs() {
        mDatabase.execSQL("CREATE TABLE test (_id INTEGER PRIMARY KEY, data TEXT);");
        ContentValues values = new ContentValues(1);
        values.put("data", "don't forget to handled 's");
        mDatabase.insert("test", "data", values);
        values.clear();
        values.put("data", "no apostrophes here");
        mDatabase.insert("test", "data", values);
        Cursor c = mDatabase.query(
                "test", null, "data GLOB ?", new String[]{"*'*"}, null, null, null);
        assertEquals(1, c.getCount());
        assertTrue(c.moveToFirst());
        assertEquals("don't forget to handled 's", c.getString(1));
        c.close();
    }

    @Suppress // unicode collator not supported yet
    @MediumTest
    @Test
    public void testTokenize() {
        Cursor c;
        mDatabase.execSQL("CREATE TABLE tokens (" +
                "token TEXT COLLATE unicode," +
                "source INTEGER," +
                "token_index INTEGER," +
                "tag TEXT" +
                ");");
        mDatabase.execSQL("CREATE TABLE tokens_no_index (" +
                "token TEXT COLLATE unicode," +
                "source INTEGER" +
                ");");
        
        Assert.assertEquals(0, longForQuery(mDatabase,
                "SELECT _TOKENIZE(NULL, NULL, NULL, NULL)", null));
        Assert.assertEquals(0, longForQuery(mDatabase,
                "SELECT _TOKENIZE('tokens', NULL, NULL, NULL)", null));
        Assert.assertEquals(0, longForQuery(mDatabase,
                "SELECT _TOKENIZE('tokens', 10, NULL, NULL)", null));
        Assert.assertEquals(0, longForQuery(mDatabase,
                "SELECT _TOKENIZE('tokens', 10, 'some string', NULL)", null));
     
        Assert.assertEquals(3, longForQuery(mDatabase,
                "SELECT _TOKENIZE('tokens', 11, 'some string ok', ' ', 1, 'foo')", null));
        Assert.assertEquals(2, longForQuery(mDatabase,
                "SELECT _TOKENIZE('tokens', 11, 'second field', ' ', 1, 'bar')", null));

        Assert.assertEquals(3, longForQuery(mDatabase,
                "SELECT _TOKENIZE('tokens_no_index', 20, 'some string ok', ' ')", null));
        Assert.assertEquals(3, longForQuery(mDatabase,
                "SELECT _TOKENIZE('tokens_no_index', 21, 'foo bar baz', ' ', 0)", null));

        // test Chinese
        String chinese = "\u4eac\u4ec5 \u5c3d\u5f84\u60ca";
        Assert.assertEquals(2, longForQuery(mDatabase,
                "SELECT _TOKENIZE('tokens', 12,'" + chinese + "', ' ', 1)", null));
        
        String icustr = "Fr\u00e9d\u00e9ric Hj\u00f8nnev\u00e5g";
        
        Assert.assertEquals(2, longForQuery(mDatabase,
                "SELECT _TOKENIZE('tokens', 13, '" + icustr + "', ' ', 1)", null));
        
        Assert.assertEquals(9, longForQuery(mDatabase,
                "SELECT count(*) from tokens;", null));      

        String key = DatabaseUtils.getHexCollationKey("Frederic Hjonneva");
        Assert.assertEquals(1, longForQuery(mDatabase,
                "SELECT count(*) from tokens where token GLOB '" + key + "*'", null));      
        Assert.assertEquals(13, longForQuery(mDatabase,
                "SELECT source from tokens where token GLOB '" + key + "*'", null));
        Assert.assertEquals(0, longForQuery(mDatabase,
                "SELECT token_index from tokens where token GLOB '" + key + "*'", null));
        key = DatabaseUtils.getHexCollationKey("Hjonneva");
        Assert.assertEquals(1, longForQuery(mDatabase,
                "SELECT count(*) from tokens where token GLOB '" + key + "*'", null));
        Assert.assertEquals(13, longForQuery(mDatabase,
                "SELECT source from tokens where token GLOB '" + key + "*'", null));
        Assert.assertEquals(1, longForQuery(mDatabase,
                "SELECT token_index from tokens where token GLOB '" + key + "*'", null));
        
        key = DatabaseUtils.getHexCollationKey("some string ok");
        Assert.assertEquals(1,  longForQuery(mDatabase,
                "SELECT count(*) from tokens where token GLOB '" + key + "*'", null));
        Assert.assertEquals(11, longForQuery(mDatabase,
                "SELECT source from tokens where token GLOB '" + key + "*'", null));
        Assert.assertEquals(0, longForQuery(mDatabase,
                "SELECT token_index from tokens where token GLOB '" + key + "*'", null));
        Assert.assertEquals("foo", stringForQuery(mDatabase,
                "SELECT tag from tokens where token GLOB '" + key + "*'", null));
        key = DatabaseUtils.getHexCollationKey("string");
        Assert.assertEquals(1, longForQuery(mDatabase,
                "SELECT count(*) from tokens where token GLOB '" + key + "*'", null));
        Assert.assertEquals(11, longForQuery(mDatabase,
                "SELECT source from tokens where token GLOB '" + key + "*'", null));
        Assert.assertEquals(1, longForQuery(mDatabase,
                "SELECT token_index from tokens where token GLOB '" + key + "*'", null));
        Assert.assertEquals("foo", stringForQuery(mDatabase,
                "SELECT tag from tokens where token GLOB '" + key + "*'", null));
        key = DatabaseUtils.getHexCollationKey("ok");
        Assert.assertEquals(1, longForQuery(mDatabase,
                "SELECT count(*) from tokens where token GLOB '" + key + "*'", null));
        Assert.assertEquals(11, longForQuery(mDatabase,
                "SELECT source from tokens where token GLOB '" + key + "*'", null));
        Assert.assertEquals(2, longForQuery(mDatabase,
                "SELECT token_index from tokens where token GLOB '" + key + "*'", null));
        Assert.assertEquals("foo", stringForQuery(mDatabase,
                "SELECT tag from tokens where token GLOB '" + key + "*'", null));

        key = DatabaseUtils.getHexCollationKey("second field");
        Assert.assertEquals(1, longForQuery(mDatabase,
                "SELECT count(*) from tokens where token GLOB '" + key + "*'", null));
        Assert.assertEquals(11, longForQuery(mDatabase,
                "SELECT source from tokens where token GLOB '" + key + "*'", null));
        Assert.assertEquals(0, longForQuery(mDatabase,
                "SELECT token_index from tokens where token GLOB '" + key + "*'", null));
        Assert.assertEquals("bar", stringForQuery(mDatabase,
                "SELECT tag from tokens where token GLOB '" + key + "*'", null));
        key = DatabaseUtils.getHexCollationKey("field");
        Assert.assertEquals(1, longForQuery(mDatabase,
                "SELECT count(*) from tokens where token GLOB '" + key + "*'", null));
        Assert.assertEquals(11, longForQuery(mDatabase,
                "SELECT source from tokens where token GLOB '" + key + "*'", null));
        Assert.assertEquals(1, longForQuery(mDatabase,
                "SELECT token_index from tokens where token GLOB '" + key + "*'", null));
        Assert.assertEquals("bar", stringForQuery(mDatabase,
                "SELECT tag from tokens where token GLOB '" + key + "*'", null));

        key = DatabaseUtils.getHexCollationKey(chinese);
        String[] a = new String[1];
        a[0] = key;
        Assert.assertEquals(1, longForQuery(mDatabase,
                "SELECT count(*) from tokens where token= ?", a));
        Assert.assertEquals(12, longForQuery(mDatabase,
                "SELECT source from tokens where token= ?", a));
        Assert.assertEquals(0, longForQuery(mDatabase,
                "SELECT token_index from tokens where token= ?", a));
        a[0] += "*";
        Assert.assertEquals(1, longForQuery(mDatabase,
             "SELECT count(*) from tokens where token GLOB ?", a));        
        Assert.assertEquals(12, longForQuery(mDatabase,
                "SELECT source from tokens where token GLOB ?", a));
        Assert.assertEquals(0, longForQuery(mDatabase,
                "SELECT token_index from tokens where token GLOB ?", a));

       Assert.assertEquals(1, longForQuery(mDatabase,
                "SELECT count(*) from tokens where token= '" + key + "'", null));
       Assert.assertEquals(12, longForQuery(mDatabase,
               "SELECT source from tokens where token= '" + key + "'", null));
       Assert.assertEquals(0, longForQuery(mDatabase,
               "SELECT token_index from tokens where token= '" + key + "'", null));
        
        Assert.assertEquals(1, longForQuery(mDatabase,
                "SELECT count(*) from tokens where token GLOB '" + key + "*'", null));        
        Assert.assertEquals(12, longForQuery(mDatabase,
                "SELECT source from tokens where token GLOB '" + key + "*'", null));
        Assert.assertEquals(0, longForQuery(mDatabase,
                "SELECT token_index from tokens where token GLOB '" + key + "*'", null));
        
        key = DatabaseUtils.getHexCollationKey("\u4eac\u4ec5");
        Assert.assertEquals(1, longForQuery(mDatabase,
                "SELECT count(*) from tokens where token GLOB '" + key + "*'", null));
        Assert.assertEquals(12, longForQuery(mDatabase,
                "SELECT source from tokens where token GLOB '" + key + "*'", null));
        Assert.assertEquals(0, longForQuery(mDatabase,
                "SELECT token_index from tokens where token GLOB '" + key + "*'", null));
        
        key = DatabaseUtils.getHexCollationKey("\u5c3d\u5f84\u60ca");
        Log.d("DatabaseGeneralTest", "key = " + key);
        Assert.assertEquals(1, longForQuery(mDatabase,
                "SELECT count(*) from tokens where token GLOB '" + key + "*'", null));
        Assert.assertEquals(12, longForQuery(mDatabase,
                "SELECT source from tokens where token GLOB '" + key + "*'", null));
        Assert.assertEquals(1, longForQuery(mDatabase,
                "SELECT token_index from tokens where token GLOB '" + key + "*'", null));
        
        Assert.assertEquals(0, longForQuery(mDatabase,
                "SELECT count(*) from tokens where token GLOB 'ab*'", null));        

        key = DatabaseUtils.getHexCollationKey("some string ok");
        Assert.assertEquals(1, longForQuery(mDatabase,
                "SELECT count(*) from tokens_no_index where token GLOB '" + key + "*'", null));
        Assert.assertEquals(20, longForQuery(mDatabase,
                "SELECT source from tokens_no_index where token GLOB '" + key + "*'", null));

        key = DatabaseUtils.getHexCollationKey("bar");
        Assert.assertEquals(1, longForQuery(mDatabase,
                "SELECT count(*) from tokens_no_index where token GLOB '" + key + "*'", null));
        Assert.assertEquals(21, longForQuery(mDatabase,
                "SELECT source from tokens_no_index where token GLOB '" + key + "*'", null));
    }
    
    @MediumTest
    @Test
    public void testTransactions() {
        mDatabase.execSQL("CREATE TABLE test (num INTEGER);");
        mDatabase.execSQL("INSERT INTO test (num) VALUES (0)");

        // Make sure that things work outside an explicit transaction.
        setNum(1);
        checkNum(1);

        // Test a single-level transaction.
        setNum(0);
        mDatabase.beginTransaction();
        setNum(1);
        mDatabase.setTransactionSuccessful();
        mDatabase.endTransaction();
        checkNum(1);
        Assert.assertFalse(mDatabase.isDbLockedByCurrentThread());

        // Test a rolled-back transaction.
        setNum(0);
        mDatabase.beginTransaction();
        setNum(1);
        mDatabase.endTransaction();
        checkNum(0);
        Assert.assertFalse(mDatabase.isDbLockedByCurrentThread());

        // We should get an error if we end a non-existent transaction.
        assertThrowsIllegalState(new Runnable() { public void run() {
            mDatabase.endTransaction();
        }});

        // We should get an error if a set a non-existent transaction as clean.
        assertThrowsIllegalState(new Runnable() { public void run() {
            mDatabase.setTransactionSuccessful();
        }});

        mDatabase.beginTransaction();
        mDatabase.setTransactionSuccessful();
        // We should get an error if we mark a transaction as clean twice.
        assertThrowsIllegalState(new Runnable() { public void run() {
            mDatabase.setTransactionSuccessful();
        }});
        // We should get an error if we begin a transaction after marking the parent as clean.
        assertThrowsIllegalState(new Runnable() { public void run() {
            mDatabase.beginTransaction();
        }});
        mDatabase.endTransaction();
        Assert.assertFalse(mDatabase.isDbLockedByCurrentThread());

        // Test a two-level transaction.
        setNum(0);
        mDatabase.beginTransaction();
        mDatabase.beginTransaction();
        setNum(1);
        mDatabase.setTransactionSuccessful();
        mDatabase.endTransaction();
        mDatabase.setTransactionSuccessful();
        mDatabase.endTransaction();
        checkNum(1);
        Assert.assertFalse(mDatabase.isDbLockedByCurrentThread());

        // Test rolling back an inner transaction.
        setNum(0);
        mDatabase.beginTransaction();
        mDatabase.beginTransaction();
        setNum(1);
        mDatabase.endTransaction();
        mDatabase.setTransactionSuccessful();
        mDatabase.endTransaction();
        checkNum(0);
        Assert.assertFalse(mDatabase.isDbLockedByCurrentThread());

        // Test rolling back an outer transaction.
        setNum(0);
        mDatabase.beginTransaction();
        mDatabase.beginTransaction();
        setNum(1);
        mDatabase.setTransactionSuccessful();
        mDatabase.endTransaction();
        mDatabase.endTransaction();
        checkNum(0);
        Assert.assertFalse(mDatabase.isDbLockedByCurrentThread());
    }

    private void setNum(int num) {
        mDatabase.execSQL("UPDATE test SET num = " + num);
    }

    private void checkNum(int num) {
        Assert.assertEquals(
                num, longForQuery(mDatabase, "SELECT num FROM test", null));
    }

    private void assertThrowsIllegalState(Runnable r) {
        boolean ok = false;
        try {
            r.run();
        } catch (IllegalStateException e) {
            ok = true;
        }
        Assert.assertTrue(ok);
    }

    @MediumTest
    @Test
    public void testContentValues() {
        ContentValues values = new ContentValues();
        values.put("string", "value");
        assertEquals("value", values.getAsString("string"));
        byte[] bytes = new byte[42];
        Arrays.fill(bytes, (byte) 0x28);
        values.put("byteArray", bytes);
        assertTrue(Arrays.equals(bytes, values.getAsByteArray("byteArray")));

        // Write the ContentValues to a Parcel and then read them out
        Parcel p = Parcel.obtain();
        values.writeToParcel(p, 0);
        p.setDataPosition(0);
        values = ContentValues.CREATOR.createFromParcel(p);

        // Read the values out again and make sure they're the same
        assertTrue(Arrays.equals(bytes, values.getAsByteArray("byteArray")));
        assertEquals("value", values.get("string"));
    }

    public static final int TABLE_INFO_PRAGMA_COLUMNNAME_INDEX = 1;
    public static final int TABLE_INFO_PRAGMA_DEFAULT_INDEX = 4;

    @MediumTest
    @Test
    public void testTableInfoPragma() {
        mDatabase.execSQL("CREATE TABLE pragma_test (" +
                "i INTEGER DEFAULT 1234, " +
                "j INTEGER, " +
                "s TEXT DEFAULT 'hello', " +
                "t TEXT, " +
                "'select' TEXT DEFAULT \"hello\")");
        try {
            Cursor cur = mDatabase.rawQuery("PRAGMA table_info(pragma_test)", null);
            Assert.assertEquals(5, cur.getCount());

            Assert.assertTrue(cur.moveToNext());
            Assert.assertEquals("i",
                    cur.getString(TABLE_INFO_PRAGMA_COLUMNNAME_INDEX));
            Assert.assertEquals("1234",
                    cur.getString(TABLE_INFO_PRAGMA_DEFAULT_INDEX));

            Assert.assertTrue(cur.moveToNext());
            Assert.assertEquals("j",
                    cur.getString(TABLE_INFO_PRAGMA_COLUMNNAME_INDEX));
            Assert.assertEquals(null, cur.getString(TABLE_INFO_PRAGMA_DEFAULT_INDEX));

            Assert.assertTrue(cur.moveToNext());
            Assert.assertEquals("s",
                    cur.getString(TABLE_INFO_PRAGMA_COLUMNNAME_INDEX));
            Assert.assertEquals("'hello'",
                    cur.getString(TABLE_INFO_PRAGMA_DEFAULT_INDEX));

            Assert.assertTrue(cur.moveToNext());
            Assert.assertEquals("t",
                    cur.getString(TABLE_INFO_PRAGMA_COLUMNNAME_INDEX));
            Assert.assertEquals(null, cur.getString(TABLE_INFO_PRAGMA_DEFAULT_INDEX));

            Assert.assertTrue(cur.moveToNext());
            Assert.assertEquals("select",
                    cur.getString(TABLE_INFO_PRAGMA_COLUMNNAME_INDEX));
            Assert.assertEquals("\"hello\"",
                    cur.getString(TABLE_INFO_PRAGMA_DEFAULT_INDEX));

            cur.close();
        } catch (Throwable t) {
            t.printStackTrace();
            throw new RuntimeException(
                    "If you see this test fail, it's likely that something about " +
                    "sqlite's PRAGMA table_info(...) command has changed.", t);
        }
    }

    @MediumTest
    @Test
    public void testSemicolonsInStatements() {
        mDatabase.execSQL("CREATE TABLE pragma_test (" +
                "i INTEGER DEFAULT 1234, " +
                "j INTEGER, " +
                "s TEXT DEFAULT 'hello', " +
                "t TEXT, " +
                "'select' TEXT DEFAULT \"hello\")");
        try {
            // ending the sql statement with  semicolons shouldn't be a problem.
            Cursor cur = mDatabase.rawQuery("PRAGMA database_list;", null);
            cur.close();
            // two semicolons in the statement shouldn't be a problem.
            cur = mDatabase.rawQuery("PRAGMA database_list;;", null);
            cur.close();
        } catch (Throwable t) {
            fail("unexpected, of course");
        }
    }

    @MediumTest
    @Test
    public void testUnionsWithBindArgs() {
        /* make sure unions with bindargs work http://b/issue?id=1061291 */
        mDatabase.execSQL("CREATE TABLE A (i int);");
        mDatabase.execSQL("create table B (k int);");
        mDatabase.execSQL("create table C (n int);");
        mDatabase.execSQL("insert into A values(1);");
        mDatabase.execSQL("insert into A values(2);");
        mDatabase.execSQL("insert into A values(3);");
        mDatabase.execSQL("insert into B values(201);");
        mDatabase.execSQL("insert into B values(202);");
        mDatabase.execSQL("insert into B values(203);");
        mDatabase.execSQL("insert into C values(901);");
        mDatabase.execSQL("insert into C values(902);");
        String s = "select i from A where i > 2 " +
                "UNION select k from B where k > 201 " +
                "UNION select n from C where n !=900;";
        Cursor c = mDatabase.rawQuery(s, null);
        int n = c.getCount();
        c.close();
        String s1 = "select i from A where i > ? " +
                "UNION select k from B where k > ? " +
                "UNION select n from C where n != ?;";
        Cursor c1 = mDatabase.rawQuery(s1, new String[]{"2", "201", "900"});
        assertEquals(n, c1.getCount());
        c1.close();
    }

    /**
     * This test is available only when the platform has a locale with the language "ja".
     * It finishes without failure when it is not available.  
     */
    @Suppress
    @MediumTest
    @Test
    public void testCollateLocalizedForJapanese() {
        final String testName = "DatabaseGeneralTest#testCollateLocalizedForJapanese()";
        final Locale[] localeArray = Locale.getAvailableLocales();
        final String japanese = Locale.JAPANESE.getLanguage();
        final String english = Locale.ENGLISH.getLanguage();
        Locale japaneseLocale = null;
        Locale englishLocale = null;
        for (Locale locale : localeArray) {
            if (locale != null) {
                final String language = locale.getLanguage();
                if (language == null) {
                    continue;
                } else if (language.equals(japanese)) {
                    japaneseLocale = locale;
                } else if (language.equals(english)) {
                    englishLocale = locale;
                }
            }
            
            if (japaneseLocale != null && englishLocale != null) {
                break;
            }
        }

        if (japaneseLocale == null || englishLocale == null) {
            Log.d(TAG, testName + "n is silently skipped since " +
                    (englishLocale == null ?
                            (japaneseLocale == null ?
                                    "Both English and Japanese locales do not exist." :
                                    "English locale does not exist.") :
                            (japaneseLocale == null ?
                                    "Japanese locale does not exist." :
                                    "...why?")));
            return;
        }

        Locale originalLocale = Locale.getDefault();
        try {

            final String dbName = "collate_localized_test";
            mDatabase.execSQL("CREATE TABLE " + dbName + " (" +
                    "_id INTEGER PRIMARY KEY, " +
                    "s TEXT COLLATE LOCALIZED) ");
            //DatabaseUtils.InsertHelper ih =
            //    new DatabaseUtils.InsertHelper(mDatabase, dbName);
            ContentValues cv = new ContentValues();

            cv = new ContentValues();  //
            cv.put("s", "\uFF75\uFF77\uFF85\uFF9C");  // O-ki-na-wa in half-width Katakana
            //ih.insert(cv);

            cv = new ContentValues();  //
            cv.put("s", "\u306B\u307B\u3093");  // Ni-ho-n in Hiragana
            //ih.insert(cv);

            cv = new ContentValues();  //
            cv.put("s", "\u30A2\u30E1\u30EA\u30AB");  // A-me-ri-ca in hull-width Katakana
            //ih.insert(cv);

            // Assume setLocale() does REINDEX and an English locale does not consider
            // Japanese-specific LOCALIZED order.
            Locale.setDefault(englishLocale);
            Locale.setDefault(japaneseLocale);

            Cursor cur = mDatabase.rawQuery(
                    "SELECT * FROM " + dbName + " ORDER BY s", null);
            assertTrue(cur.moveToFirst());
            assertEquals("\u30A2\u30E1\u30EA\u30AB", cur.getString(1));
            assertTrue(cur.moveToNext());
            assertEquals("\uFF75\uFF77\uFF85\uFF9C", cur.getString(1));
            assertTrue(cur.moveToNext());
            assertEquals("\u306B\u307B\u3093", cur.getString(1));
        } finally {
            if (originalLocale != null) {
                try {
                    Locale.setDefault(originalLocale);
                } catch (Exception ignored) {
                }
            }
        }
    }

    @SmallTest
    @Test
    public void testSetMaxCacheSize() {
        mDatabase.execSQL("CREATE TABLE test (i int, j int);");
        mDatabase.execSQL("insert into test values(1,1);");
        // set cache size
        int N = SQLiteDatabase.MAX_SQL_CACHE_SIZE;
        mDatabase.setMaxSqlCacheSize(N);

        // try reduce cachesize
        try {
            mDatabase.setMaxSqlCacheSize(1);
        } catch (IllegalStateException e) {
            assertTrue(e.getMessage().contains("cannot set cacheSize to a value less than"));
        }
    }

    @LargeTest
    @Test
    public void testDefaultDatabaseErrorHandler() {
        DefaultDatabaseErrorHandler errorHandler = new DefaultDatabaseErrorHandler();

        // close the database. and call corruption handler.
        // it should delete the database file.
        File dbfile = new File(mDatabase.getPath());
        mDatabase.close();
        assertFalse(mDatabase.isOpen());
        assertTrue(dbfile.exists());
        try {
            errorHandler.onCorruption(mDatabase);
            assertFalse(dbfile.exists());
        } catch (Exception e) {
            fail("unexpected");
        }

        // create an in-memory database. and corruption handler shouldn't try to delete it
        SQLiteDatabase memoryDb = SQLiteDatabase.openOrCreateDatabase(":memory:", null);
        assertNotNull(memoryDb);
        memoryDb.close();
        assertFalse(memoryDb.isOpen());
        try {
            errorHandler.onCorruption(memoryDb);
        } catch (Exception e) {
            fail("unexpected");
        }

        // create a database, keep it open, call corruption handler. database file should be deleted
        SQLiteDatabase dbObj = SQLiteDatabase.openOrCreateDatabase(mDatabase.getPath(), null);
        assertTrue(dbfile.exists());
        assertNotNull(dbObj);
        assertTrue(dbObj.isOpen());
        try {
            errorHandler.onCorruption(dbObj);
            assertFalse(dbfile.exists());
        } catch (Exception e) {
            fail("unexpected");
        }

        // create a database, attach 2 more databases to it
        //    attached database # 1: ":memory:"
        //    attached database # 2: mDatabase.getPath() + "1";
        // call corruption handler. database files including the one for attached database # 2
        // should be deleted
        String attachedDb1File = mDatabase.getPath() + "1";
        dbObj = SQLiteDatabase.openOrCreateDatabase(mDatabase.getPath(), null);
        dbObj.execSQL("ATTACH DATABASE ':memory:' as memoryDb");
        dbObj.execSQL("ATTACH DATABASE '" +  attachedDb1File + "' as attachedDb1");
        assertTrue(dbfile.exists());
        assertTrue(new File(attachedDb1File).exists());
        assertNotNull(dbObj);
        assertTrue(dbObj.isOpen());
        List<Pair<String, String>> attachedDbs = dbObj.getAttachedDbs();
        try {
            errorHandler.onCorruption(dbObj);
            assertFalse(dbfile.exists());
            assertFalse(new File(attachedDb1File).exists());
        } catch (Exception e) {
            fail("unexpected");
        }

        // same as above, except this is a bit of stress testing. attach 5 database files
        // and make sure they are all removed.
        int N = 5;
        ArrayList<String> attachedDbFiles = new ArrayList<String>(N);
        for (int i = 0; i < N; i++) {
            attachedDbFiles.add(mDatabase.getPath() + i);
        }
        dbObj = SQLiteDatabase.openOrCreateDatabase(mDatabase.getPath(), null);
        dbObj.execSQL("ATTACH DATABASE ':memory:' as memoryDb");
        for (int i = 0; i < N; i++) {
            dbObj.execSQL("ATTACH DATABASE '" +  attachedDbFiles.get(i) + "' as attachedDb" + i);
        }
        assertTrue(dbfile.exists());
        for (int i = 0; i < N; i++) {
            assertTrue(new File(attachedDbFiles.get(i)).exists());
        }
        assertNotNull(dbObj);
        assertTrue(dbObj.isOpen());
        attachedDbs = dbObj.getAttachedDbs();
        try {
            errorHandler.onCorruption(dbObj);
            assertFalse(dbfile.exists());
            for (int i = 0; i < N; i++) {
                assertFalse(new File(attachedDbFiles.get(i)).exists());
            }
        } catch (Exception e) {
            fail("unexpected");
        }
    }

    /**
     * Utility method to run the query on the db and return the value in the
     * first column of the first row.
     */
    public static long longForQuery(SQLiteDatabase db, String query, String[] selectionArgs) {
        SQLiteStatement prog = db.compileStatement(query);
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
    public static long longForQuery(SQLiteStatement prog, String[] selectionArgs) {
        prog.bindAllArgsAsStrings(selectionArgs);
        return prog.simpleQueryForLong();
    }

    /**
     * Utility method to run the query on the db and return the value in the
     * first column of the first row.
     */
    public static String stringForQuery(SQLiteDatabase db, String query, String[] selectionArgs) {
        SQLiteStatement prog = db.compileStatement(query);
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

}
