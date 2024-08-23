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

#define LOG_TAG "SQLiteDebug"

#include <jni.h>
#include "JNIHelp.h"
#include "ALog-priv.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include <sqlite3.h>

namespace android {

static struct {
    jfieldID memoryUsed;
    jfieldID pageCacheOverflow;
    jfieldID largestMemAlloc;
} gSQLiteDebugPagerStatsClassInfo;

static void nativeGetPagerStats(JNIEnv *env, jobject clazz, jobject statsObj)
{
    int memoryUsed;
    int pageCacheOverflow;
    int largestMemAlloc;
    int unused;

    sqlite3_status(SQLITE_STATUS_MEMORY_USED, &memoryUsed, &unused, 0);
    sqlite3_status(SQLITE_STATUS_MALLOC_SIZE, &unused, &largestMemAlloc, 0);
    sqlite3_status(SQLITE_STATUS_PAGECACHE_OVERFLOW, &pageCacheOverflow, &unused, 0);
    env->SetIntField(statsObj, gSQLiteDebugPagerStatsClassInfo.memoryUsed, memoryUsed);
    env->SetIntField(statsObj, gSQLiteDebugPagerStatsClassInfo.pageCacheOverflow,
            pageCacheOverflow);
    env->SetIntField(statsObj, gSQLiteDebugPagerStatsClassInfo.largestMemAlloc, largestMemAlloc);
}

/*
 * JNI registration.
 */

static JNINativeMethod gMethods[] =
{
    { "nativeGetPagerStats", "(Lio/requery/android/database/sqlite/SQLiteDebug$PagerStats;)V",
            (void*) nativeGetPagerStats },
};

int register_android_database_SQLiteDebug(JNIEnv *env)
{
    jclass clazz;
    FIND_CLASS(clazz, "io/requery/android/database/sqlite/SQLiteDebug$PagerStats");

    GET_FIELD_ID(gSQLiteDebugPagerStatsClassInfo.memoryUsed, clazz,
            "memoryUsed", "I");
    GET_FIELD_ID(gSQLiteDebugPagerStatsClassInfo.largestMemAlloc, clazz,
            "largestMemAlloc", "I");
    GET_FIELD_ID(gSQLiteDebugPagerStatsClassInfo.pageCacheOverflow, clazz,
            "pageCacheOverflow", "I");

    return jniRegisterNativeMethods(env, "io/requery/android/database/sqlite/SQLiteDebug",
            gMethods, NELEM(gMethods));
}

} // namespace android
