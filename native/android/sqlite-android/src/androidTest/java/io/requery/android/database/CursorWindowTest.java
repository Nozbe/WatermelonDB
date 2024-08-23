/*
 * Copyright (C) 2008 The Android Open Source Project
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

import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.Arrays;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.filters.SmallTest;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.fail;
import static org.junit.Assert.assertTrue;

@RunWith(AndroidJUnit4.class)
public class CursorWindowTest {
    static {
        System.loadLibrary("sqlite3x");
    }
    public boolean isPerformanceOnly() {
        return false;
    }

    @SmallTest
    @Test
    public void testConstructor_WithName() {
        CursorWindow window = new CursorWindow("MyWindow");
        assertEquals("MyWindow", window.getName());
        assertEquals(0, window.getStartPosition());
        assertEquals(2048 * 1024, window.getWindowSizeBytes());
        window.close();
    }

    @SmallTest
    @Test
    public void testConstructorWithEmptyName() {
        CursorWindow window = new CursorWindow("");
        assertEquals("<unnamed>", window.getName());
        assertEquals(0, window.getStartPosition());
        assertEquals(2048 * 1024, window.getWindowSizeBytes());
        window.close();
    }

    @SmallTest
    @Test
    public void testConstructorWithNullName() {
        CursorWindow window = new CursorWindow(null);
        assertEquals("<unnamed>", window.getName());
        assertEquals(0, window.getStartPosition());
        assertEquals(2048 * 1024, window.getWindowSizeBytes());
        window.close();
    }

    @SmallTest
    @Test
    public void testValues() {
        CursorWindow window = new CursorWindow("MyWindow");
        doTestValues(window);
        window.close();
    }

    private void doTestValues(CursorWindow window) {
        assertTrue(window.setNumColumns(7));
        assertTrue(window.allocRow());
        double db1 = 1.26;
        assertTrue(window.putDouble(db1, 0, 0));
        double db2 = window.getDouble(0, 0);
        assertEquals(db1, db2, 0);

        long int1 = Long.MAX_VALUE;
        assertTrue(window.putLong(int1, 0, 1));
        long int2 = window.getLong(0, 1);
        assertEquals(int1, int2);

        assertTrue(window.putString("1198032740000", 0, 3));
        assertEquals("1198032740000", window.getString(0, 3));
        assertEquals(1198032740000L, window.getLong(0, 3));

        assertTrue(window.putString(Long.toString(1198032740000L), 0, 3));
        assertEquals(Long.toString(1198032740000L), window.getString(0, 3));
        assertEquals(1198032740000L, window.getLong(0, 3));
        
        assertTrue(window.putString(Double.toString(42.0), 0, 4));
        assertEquals(Double.toString(42.0), window.getString(0, 4));
        assertEquals(42.0, window.getDouble(0, 4), 0);
        
        // put blob
        byte[] blob = new byte[1000];
        byte value = 99;
        Arrays.fill(blob, value);
        assertTrue(window.putBlob(blob, 0, 6));
        assertTrue(Arrays.equals(blob, window.getBlob(0, 6)));
    }



    @SmallTest
    @Test(expected = AssertionError.class)
    public void testConstructorDifferentSize() {
        CursorWindow window = new CursorWindow("big", 8);
        assertEquals("big", window.getName());
        assertEquals(0, window.getStartPosition());
        assertEquals(8, window.getWindowSizeBytes());
        try {
            // For window of size 8, the test should fail
            doTestValues(window);
        } finally {
            window.close();
        }
    }
}
