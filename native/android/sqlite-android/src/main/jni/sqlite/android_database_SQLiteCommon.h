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

#ifndef _ANDROID_DATABASE_SQLITE_COMMON_H
#define _ANDROID_DATABASE_SQLITE_COMMON_H

#include <jni.h>
#include <JNIHelp.h>

#include <sqlite3.h>

// Special log tags defined in SQLiteDebug.java.
#define SQLITE_LOG_TAG "SQLiteLog"
#define SQLITE_TRACE_TAG "SQLiteStatements"
#define SQLITE_PROFILE_TAG "SQLiteTime"

namespace android {

/* throw a SQLiteException with a message appropriate for the error in handle */
void throw_sqlite3_exception(JNIEnv* env, sqlite3* handle);

/* throw a SQLiteException with the given message */
void throw_sqlite3_exception(JNIEnv* env, const char* message);

/* throw a SQLiteException with a message appropriate for the error in handle
   concatenated with the given message
 */
void throw_sqlite3_exception(JNIEnv* env, sqlite3* handle, const char* message);

/* throw a SQLiteException for a given error code */
void throw_sqlite3_exception_errcode(JNIEnv* env, int errcode, const char* message);

void throw_sqlite3_exception(JNIEnv* env, int errcode,
        const char* sqlite3Message, const char* message);

}

#endif // _ANDROID_DATABASE_SQLITE_COMMON_H
