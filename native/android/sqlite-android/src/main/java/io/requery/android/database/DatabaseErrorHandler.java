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

import io.requery.android.database.sqlite.SQLiteDatabase;

/**
 * An interface to let apps define an action to take when database corruption is detected.
 */
public interface DatabaseErrorHandler {

    /**
     * The method invoked when database corruption is detected.
     * @param dbObj the {@link SQLiteDatabase} object representing the database on which corruption
     * is detected.
     */
    void onCorruption(SQLiteDatabase dbObj);
}
