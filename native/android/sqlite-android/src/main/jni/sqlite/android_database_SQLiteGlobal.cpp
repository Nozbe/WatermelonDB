/*
 * Copyright (C) 2011 The Android Open Source Project
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

#define LOG_TAG "SQLiteGlobal"

#include <jni.h>
#include <JNIHelp.h>
#include "ALog-priv.h"

#include <sqlite3.h>
//#include <sqlite3_android.h>

#include "android_database_SQLiteCommon.h"

namespace android {

// Limit heap to 8MB for now.  This is 4 times the maximum cursor window
// size, as has been used by the original code in SQLiteDatabase for
// a long time.
static const int SOFT_HEAP_LIMIT = 8 * 1024 * 1024;


// Called each time a message is logged.
static void sqliteLogCallback(void* data, int iErrCode, const char* zMsg) {
    bool verboseLog = !!data;
    if (iErrCode == 0 || iErrCode == SQLITE_CONSTRAINT || iErrCode == SQLITE_SCHEMA) {
        if (verboseLog) {
            ALOG(LOG_VERBOSE, SQLITE_LOG_TAG, "(%d) %s\n", iErrCode, zMsg);
        }
    } else {
        ALOG(LOG_ERROR, SQLITE_LOG_TAG, "(%d) %s\n", iErrCode, zMsg);
    }
}

// Sets the global SQLite configuration.
// This must be called before any other SQLite functions are called.
static void sqliteInitialize() {
    // Enable multi-threaded mode.  In this mode, SQLite is safe to use by multiple
    // threads as long as no two threads use the same database connection at the same
    // time (which we guarantee in the SQLite database wrappers).
    sqlite3_config(SQLITE_CONFIG_MULTITHREAD);

    // Redirect SQLite log messages to the Android log.
#if 0
    bool verboseLog = android_util_Log_isVerboseLogEnabled(SQLITE_LOG_TAG);
#endif
    bool verboseLog = false;
    sqlite3_config(SQLITE_CONFIG_LOG, &sqliteLogCallback, verboseLog ? (void*)1 : NULL);

    // The soft heap limit prevents the page cache allocations from growing
    // beyond the given limit, no matter what the max page cache sizes are
    // set to. The limit does not, as of 3.5.0, affect any other allocations.
    sqlite3_soft_heap_limit(SOFT_HEAP_LIMIT);

    // Initialize SQLite.
    sqlite3_initialize();
}

static jint nativeReleaseMemory(JNIEnv* env, jclass clazz) {
    return sqlite3_release_memory(SOFT_HEAP_LIMIT);
}

static JNINativeMethod sMethods[] =
{
    /* name, signature, funcPtr */
    { "nativeReleaseMemory", "()I",
            (void*)nativeReleaseMemory },
};

int register_android_database_SQLiteGlobal(JNIEnv *env)
{
    sqliteInitialize();

    return jniRegisterNativeMethods(env, "io/requery/android/database/sqlite/SQLiteGlobal",
            sMethods, NELEM(sMethods));
}

} // namespace android
