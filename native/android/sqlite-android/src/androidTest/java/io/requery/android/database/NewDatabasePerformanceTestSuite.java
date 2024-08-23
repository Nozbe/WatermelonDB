/*
 * Copyright (C) 2005 The Android Open Source Project
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

import junit.framework.TestSuite;
import org.junit.Ignore;
import org.junit.runner.RunWith;

import androidx.test.ext.junit.runners.AndroidJUnit4;

@Ignore
@RunWith(AndroidJUnit4.class)
public class NewDatabasePerformanceTestSuite extends TestSuite {

    public static TestSuite suite() {
        TestSuite suite =
          new TestSuite(NewDatabasePerformanceTestSuite.class.getName());

        suite.addTestSuite(NewDatabasePerformanceTests.
                           Insert1000.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           InsertIndexed1000.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           Select100.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           SelectStringComparison100.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           SelectIndex100.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           InnerJoin100.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           InnerJoinOneSide100.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           InnerJoinNoIndex100.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           SelectSubQIndex100.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           SelectIndexStringComparison100.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           SelectInteger100.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           SelectString100.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           SelectIntegerIndex100.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           SelectIndexString100.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           SelectStringStartsWith100.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           DeleteIndexed1000.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           Delete1000.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           DeleteWhere1000.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           DeleteIndexWhere1000.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           UpdateIndexWhere1000.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           UpdateWhere1000.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           InsertInteger10000.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           InsertIntegerIndex10000.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           InsertString10000.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           InsertStringIndexed10000.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           SelectStringStartsWith10000.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           SelectStringIndexedStartsWith10000.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           SelectInteger10000.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           SelectIntegerIndexed10000.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           SelectStringContains10000.class);
        suite.addTestSuite(NewDatabasePerformanceTests.
                           SelectStringIndexedContains10000.class);

        return suite;
    }
}
