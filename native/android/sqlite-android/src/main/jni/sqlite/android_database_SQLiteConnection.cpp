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

#define LOG_TAG "SQLiteConnection"

#include <jni.h>
#include <sys/mman.h>
#include <string.h>
#include <stdlib.h>
#include <unistd.h>
#include <assert.h>

#include "sqlite3.h"
#include "JNIHelp.h"
#include "ALog-priv.h"
#include "android_database_SQLiteCommon.h"
#include "CursorWindow.h"

// Set to 1 to use UTF16 storage for localized indexes.
#define UTF16_STORAGE 0

namespace android {

/* Busy timeout in milliseconds.
 * If another connection (possibly in another process) has the database locked for
 * longer than this amount of time then SQLite will generate a SQLITE_BUSY error.
 * The SQLITE_BUSY error is then raised as a SQLiteDatabaseLockedException.
 *
 * In ordinary usage, busy timeouts are quite rare.  Most databases only ever
 * have a single open connection at a time unless they are using WAL.  When using
 * WAL, a timeout could occur if one connection is busy performing an auto-checkpoint
 * operation.  The busy timeout needs to be long enough to tolerate slow I/O write
 * operations but not so long as to cause the application to hang indefinitely if
 * there is a problem acquiring a database lock.
 */
static const int BUSY_TIMEOUT_MS = 2500;

static JavaVM *gpJavaVM = 0;

static struct {
    jfieldID name;
    jfieldID numArgs;
    jmethodID dispatchCallback;
} gSQLiteCustomFunctionClassInfo;

static struct {
    jfieldID name;
    jfieldID numArgs;
    jfieldID flags;
    jmethodID dispatchCallback;
} gSQLiteFunctionClassInfo;

static struct {
    jclass clazz;
} gStringClassInfo;

struct SQLiteConnection {
    sqlite3* const db;
    const int openFlags;
    char* path;
    char* label;

    volatile bool canceled;

    SQLiteConnection(sqlite3* db, int openFlags, const char* path_, const char* label_) :
        db(db), openFlags(openFlags), canceled(false) {
        path = strdup(path_);
        label = strdup(label_);
    }

    ~SQLiteConnection() {
        free(path);
        free(label);
    }
};

// Called each time a statement begins execution, when tracing is enabled.
static void sqliteTraceCallback(void *data, const char *sql) {
    SQLiteConnection* connection = static_cast<SQLiteConnection*>(data);
    ALOG(LOG_VERBOSE, SQLITE_TRACE_TAG, "%s: \"%s\"\n",
            connection->label, sql);
}

// Called each time a statement finishes execution, when profiling is enabled.
static void sqliteProfileCallback(void *data, const char *sql, sqlite3_uint64 tm) {
    SQLiteConnection* connection = static_cast<SQLiteConnection*>(data);
    ALOG(LOG_VERBOSE, SQLITE_PROFILE_TAG, "%s: \"%s\" took %0.3f ms\n",
            connection->label, sql, tm * 0.000001f);
}

// Called after each SQLite VM instruction when cancelation is enabled.
static int sqliteProgressHandlerCallback(void* data) {
    SQLiteConnection* connection = static_cast<SQLiteConnection*>(data);
    return connection->canceled;
}

/*
** This function is a collation sequence callback equivalent to the built-in
** BINARY sequence. 
**
** Stock Android uses a modified version of sqlite3.c that calls out to a module
** named "sqlite3_android" to add extra built-in collations and functions to
** all database handles. Specifically, collation sequence "LOCALIZED". For now,
** this module does not include sqlite3_android (since it is difficult to build
** with the NDK only). Instead, this function is registered as "LOCALIZED" for all
** new database handles. 
*/
static int coll_localized(
  void *not_used,
  int nKey1, const void *pKey1,
  int nKey2, const void *pKey2
){
  int rc, n;
  n = nKey1<nKey2 ? nKey1 : nKey2;
  rc = memcmp(pKey1, pKey2, n);
  if( rc==0 ){
    rc = nKey1 - nKey2;
  }
  return rc;
}

static jlong nativeOpen(JNIEnv* env, jclass clazz, jstring pathStr, jint openFlags,
        jstring labelStr, jboolean enableTrace, jboolean enableProfile) {

    const char* pathChars = env->GetStringUTFChars(pathStr, NULL);
    const char* labelChars = env->GetStringUTFChars(labelStr, NULL);

    sqlite3* db;
    int err = sqlite3_open_v2(pathChars, &db, openFlags, NULL);
    if (err != SQLITE_OK) {
        env->ReleaseStringUTFChars(pathStr, pathChars);
        env->ReleaseStringUTFChars(labelStr, labelChars);
        throw_sqlite3_exception_errcode(env, err, "Could not open database");
        return 0;
    }
    err = sqlite3_create_collation(db, "localized", SQLITE_UTF8, 0, coll_localized);
    if (err != SQLITE_OK) {
        env->ReleaseStringUTFChars(pathStr, pathChars);
        env->ReleaseStringUTFChars(labelStr, labelChars);
        throw_sqlite3_exception_errcode(env, err, "Could not register collation");
        sqlite3_close(db);
        return 0;
    }

    // Check that the database is really read/write when that is what we asked for.
    if ((openFlags & SQLITE_OPEN_READWRITE) && sqlite3_db_readonly(db, NULL)) {
        env->ReleaseStringUTFChars(pathStr, pathChars);
        env->ReleaseStringUTFChars(labelStr, labelChars);
        throw_sqlite3_exception(env, db, "Could not open the database in read/write mode.");
        sqlite3_close(db);
        return 0;
    }

    // Set the default busy handler to retry automatically before returning SQLITE_BUSY.
    err = sqlite3_busy_timeout(db, BUSY_TIMEOUT_MS);
    if (err != SQLITE_OK) {
        env->ReleaseStringUTFChars(pathStr, pathChars);
        env->ReleaseStringUTFChars(labelStr, labelChars);
        throw_sqlite3_exception(env, db, "Could not set busy timeout");
        sqlite3_close(db);
        return 0;
    }

    // Register custom Android functions.
#if 0
    err = register_android_functions(db, UTF16_STORAGE);
    if (err) {
        env->ReleaseStringUTFChars(pathStr, pathChars);
        env->ReleaseStringUTFChars(labelStr, labelChars);
        throw_sqlite3_exception(env, db, "Could not register Android SQL functions.");
        sqlite3_close(db);
        return 0;
    }
#endif

    // Create wrapper object.
    SQLiteConnection* connection = new SQLiteConnection(db, openFlags, pathChars, labelChars);
    ALOGV("Opened connection %p with label '%s'", db, labelChars);
    env->ReleaseStringUTFChars(pathStr, pathChars);
    env->ReleaseStringUTFChars(labelStr, labelChars);

    // Enable tracing and profiling if requested.
    if (enableTrace) {
        sqlite3_trace(db, &sqliteTraceCallback, connection);
    }
    if (enableProfile) {
        sqlite3_profile(db, &sqliteProfileCallback, connection);
    }

    return reinterpret_cast<jlong>(connection);
}

static void nativeClose(JNIEnv* env, jclass clazz, jlong connectionPtr) {
    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);

    if (connection) {
        ALOGV("Closing connection %p", connection->db);
        int err = sqlite3_close(connection->db);
        if (err != SQLITE_OK) {
            // This can happen if sub-objects aren't closed first.  Make sure the caller knows.
            ALOGE("sqlite3_close(%p) failed: %d", connection->db, err);
            throw_sqlite3_exception(env, connection->db, "Count not close db.");
            return;
        }

        delete connection;
    }
}

static void sqliteUpdateHookCallback(void *pArg, int operationType, const char *databaseName, const char *tableName, sqlite3_int64 rowId) {
    JNIEnv* env = 0;
    gpJavaVM->GetEnv((void**)&env, JNI_VERSION_1_4);

    jobject updateCallbackObjGlobal = reinterpret_cast<jobject>(pArg);
    jobject updateCallbackObj = env->NewLocalRef(updateCallbackObjGlobal);

    // TODO: Do something magical
    // Get the Java class and method ID
    jclass updateHookManagerClass = env->GetObjectClass(updateCallbackObj);
    jmethodID onUpdateMethod = env->GetMethodID(updateHookManagerClass, "onUpdateFromNative", "(ILjava/lang/String;Ljava/lang/String;J)V");

    if (onUpdateMethod != NULL) {
        // Create Java strings from C strings
        jstring dbName = env->NewStringUTF(databaseName);
        jstring tblName = env->NewStringUTF(tableName);

        // Call the Java method
        env->CallVoidMethod(updateCallbackObj, onUpdateMethod, operationType, dbName, tblName, rowId);

        // Clean up local references
        env->DeleteLocalRef(dbName);
        env->DeleteLocalRef(tblName);
    } else {
        ALOGE("Failed to find onUpdateFromNative method");
    }

    env->DeleteLocalRef(updateCallbackObj);

    if (env->ExceptionCheck()) {
        ALOGE("An exception was thrown by custom update callback.");
        /* LOGE_EX(env); */
        env->ExceptionClear();
    }
}

// Called each time a custom function is evaluated.
static void sqliteCustomFunctionCallback(sqlite3_context *context,
        int argc, sqlite3_value **argv) {

    JNIEnv* env = 0;
    gpJavaVM->GetEnv((void**)&env, JNI_VERSION_1_4);

    // Get the callback function object.
    // Create a new local reference to it in case the callback tries to do something
    // dumb like unregister the function (thereby destroying the global ref) while it is running.
    jobject functionObjGlobal = reinterpret_cast<jobject>(sqlite3_user_data(context));
    jobject functionObj = env->NewLocalRef(functionObjGlobal);

    jobjectArray argsArray = env->NewObjectArray(argc, gStringClassInfo.clazz, NULL);
    if (argsArray) {
        for (int i = 0; i < argc; i++) {
            const jchar* arg = static_cast<const jchar*>(sqlite3_value_text16(argv[i]));
            if (!arg) {
                ALOGW("NULL argument in custom_function_callback.  This should not happen.");
            } else {
                size_t argLen = sqlite3_value_bytes16(argv[i]) / sizeof(jchar);
                jstring argStr = env->NewString(arg, argLen);
                if (!argStr) {
                    goto error; // out of memory error
                }
                env->SetObjectArrayElement(argsArray, i, argStr);
                env->DeleteLocalRef(argStr);
            }
        }

        {
            jobject result = env->CallObjectMethod(functionObj,
                    gSQLiteCustomFunctionClassInfo.dispatchCallback, argsArray);
            if (env->ExceptionCheck()) {
                sqlite3_result_error(context, "Custom function exception", -1);
            } else if (result == NULL) {
                sqlite3_result_null(context);
            } else {
                jstring str = static_cast<jstring>(result);
                const char* chars = env->GetStringUTFChars(str, NULL);
                sqlite3_result_text(context, chars, -1, SQLITE_TRANSIENT);
                env->ReleaseStringUTFChars(str, chars);
            }
            env->DeleteLocalRef(result);
        }
error:
        env->DeleteLocalRef(argsArray);
    }

    env->DeleteLocalRef(functionObj);

    if (env->ExceptionCheck()) {
        ALOGE("An exception was thrown by custom SQLite function.");
        /* LOGE_EX(env); */
        env->ExceptionClear();
    }
}

// Called each time a Function is evaluated.
static void sqliteFunctionCallback(sqlite3_context *context,
                                   int argc, sqlite3_value **argv) {

    JNIEnv* env = 0;
    gpJavaVM->GetEnv((void**)&env, JNI_VERSION_1_4);

    // Get the callback function object.
    // Create a new local reference to it in case the callback tries to do something
    // dumb like unregister the function (thereby destroying the global ref) while it is running.
    jobject functionObjGlobal = reinterpret_cast<jobject>(sqlite3_user_data(context));
    jobject functionObj = env->NewLocalRef(functionObjGlobal);

    jlong contextPtr = jlong(context);
    jlong argsPtr = jlong(argv);
    jint argsCount = jint(argc);

    env->CallVoidMethod(functionObj,
            gSQLiteFunctionClassInfo.dispatchCallback,
            contextPtr,
            argsPtr,
            argsCount
    );
    if (env->ExceptionCheck()) {
        sqlite3_result_error(context, "Custom function exception", -1);
    }

    env->DeleteLocalRef(functionObj);

    if (env->ExceptionCheck()) {
        ALOGE("An exception was thrown by custom SQLite function.");
        /* LOGE_EX(env); */
        env->ExceptionClear();
    }
}

// Called when a custom function is destroyed.
static void sqliteCustomFunctionDestructor(void* data) {
    jobject functionObjGlobal = reinterpret_cast<jobject>(data);
    JNIEnv* env = 0;
    gpJavaVM->GetEnv((void**)&env, JNI_VERSION_1_4);
    env->DeleteGlobalRef(functionObjGlobal);
}

static void nativeRegisterCustomFunction(JNIEnv* env, jclass clazz, jlong connectionPtr,
        jobject functionObj) {
    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);

    jstring nameStr = jstring(env->GetObjectField(
            functionObj, gSQLiteCustomFunctionClassInfo.name));
    jint numArgs = env->GetIntField(functionObj, gSQLiteCustomFunctionClassInfo.numArgs);

    jobject functionObjGlobal = env->NewGlobalRef(functionObj);

    const char* name = env->GetStringUTFChars(nameStr, NULL);
    int err = sqlite3_create_function_v2(connection->db, name, numArgs, SQLITE_UTF16,
            reinterpret_cast<void*>(functionObjGlobal),
            &sqliteCustomFunctionCallback, NULL, NULL, &sqliteCustomFunctionDestructor);
    env->ReleaseStringUTFChars(nameStr, name);

    if (err != SQLITE_OK) {
        ALOGE("sqlite3_create_function returned %d", err);
        env->DeleteGlobalRef(functionObjGlobal);
        throw_sqlite3_exception(env, connection->db);
        return;
    }
}

static void nativeRegisterFunction(JNIEnv *env, jclass clazz, jlong connectionPtr,
                                   jobject functionObj) {
    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);

    jstring nameStr = jstring(env->GetObjectField(
            functionObj, gSQLiteFunctionClassInfo.name));
    jint numArgs = env->GetIntField(functionObj, gSQLiteFunctionClassInfo.numArgs);
    jint flags = env->GetIntField(functionObj, gSQLiteFunctionClassInfo.flags);

    jobject functionObjGlobal = env->NewGlobalRef(functionObj);

    const char* name = env->GetStringUTFChars(nameStr, NULL);
    int err = sqlite3_create_function_v2(connection->db, name, numArgs,
                                         SQLITE_UTF16 | flags,
                                         reinterpret_cast<void*>(functionObjGlobal),
                                         &sqliteFunctionCallback, NULL, NULL, &sqliteCustomFunctionDestructor);
    env->ReleaseStringUTFChars(nameStr, name);

    if (err != SQLITE_OK) {
        ALOGE("sqlite3_create_function returned %d", err);
        env->DeleteGlobalRef(functionObjGlobal);
        throw_sqlite3_exception(env, connection->db);
        return;
    }
}

static void nativeRegisterUpdateHook(JNIEnv* env, jclass clazz, jlong connectionPtr,
                                         jobject updateCallbackObj) {
    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);

    jobject updateCallbackObjGlobal = env->NewGlobalRef(updateCallbackObj);

    if (updateCallbackObjGlobal == NULL) {
        ALOGE("Failed to create global reference for callback object");
        return;
    }

    sqlite3_update_hook(connection->db, sqliteUpdateHookCallback, reinterpret_cast<void*>(updateCallbackObjGlobal));
}

static void nativeRegisterLocalizedCollators(JNIEnv* env, jclass clazz, jlong connectionPtr,
        jstring localeStr) {
    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);
#if 0
    const char* locale = env->GetStringUTFChars(localeStr, NULL);

    int err = register_localized_collators(connection->db, locale, UTF16_STORAGE);
    env->ReleaseStringUTFChars(localeStr, locale);

    if (err != SQLITE_OK) {
        throw_sqlite3_exception(env, connection->db);
    }
#endif
}

static jlong nativePrepareStatement(JNIEnv* env, jclass clazz, jlong connectionPtr,
        jstring sqlString) {
    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);

    jsize sqlLength = env->GetStringLength(sqlString);
    const jchar* sql = env->GetStringCritical(sqlString, NULL);
    sqlite3_stmt* statement;
    int err = sqlite3_prepare16_v2(connection->db,
            sql, sqlLength * sizeof(jchar), &statement, NULL);
    env->ReleaseStringCritical(sqlString, sql);

    if (err != SQLITE_OK) {
        // Error messages like 'near ")": syntax error' are not
        // always helpful enough, so construct an error string that
        // includes the query itself.
        const char *query = env->GetStringUTFChars(sqlString, NULL);
        char *message = (char*) malloc(strlen(query) + 50);
        if (message) {
            strcpy(message, ", while compiling: "); // less than 50 chars
            strcat(message, query);
        }
        env->ReleaseStringUTFChars(sqlString, query);
        throw_sqlite3_exception(env, connection->db, message);
        free(message);
        return 0;
    }

    ALOGV("Prepared statement %p on connection %p", statement, connection->db);
    return reinterpret_cast<jlong>(statement);
}

static void nativeFinalizeStatement(JNIEnv* env, jclass clazz, jlong connectionPtr,
        jlong statementPtr) {
    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);
    sqlite3_stmt* statement = reinterpret_cast<sqlite3_stmt*>(statementPtr);

    // We ignore the result of sqlite3_finalize because it is really telling us about
    // whether any errors occurred while executing the statement.  The statement itself
    // is always finalized regardless.
    ALOGV("Finalized statement %p on connection %p", statement, connection->db);
    sqlite3_finalize(statement);
}

static jint nativeGetParameterCount(JNIEnv* env, jclass clazz, jlong connectionPtr,
        jlong statementPtr) {
    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);
    sqlite3_stmt* statement = reinterpret_cast<sqlite3_stmt*>(statementPtr);

    return sqlite3_bind_parameter_count(statement);
}

static jboolean nativeIsReadOnly(JNIEnv* env, jclass clazz, jlong connectionPtr,
        jlong statementPtr) {
    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);
    sqlite3_stmt* statement = reinterpret_cast<sqlite3_stmt*>(statementPtr);

    return sqlite3_stmt_readonly(statement) != 0;
}

static jint nativeGetColumnCount(JNIEnv* env, jclass clazz, jlong connectionPtr,
        jlong statementPtr) {
    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);
    sqlite3_stmt* statement = reinterpret_cast<sqlite3_stmt*>(statementPtr);

    return sqlite3_column_count(statement);
}

static jstring nativeGetColumnName(JNIEnv* env, jclass clazz, jlong connectionPtr,
        jlong statementPtr, jint index) {
    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);
    sqlite3_stmt* statement = reinterpret_cast<sqlite3_stmt*>(statementPtr);

    const jchar* name = static_cast<const jchar*>(sqlite3_column_name16(statement, index));
    if (name) {
        size_t length = 0;
        while (name[length]) {
            length += 1;
        }
        return env->NewString(name, length);
    }
    return NULL;
}

static void nativeBindNull(JNIEnv* env, jclass clazz, jlong connectionPtr,
        jlong statementPtr, jint index) {
    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);
    sqlite3_stmt* statement = reinterpret_cast<sqlite3_stmt*>(statementPtr);

    int err = sqlite3_bind_null(statement, index);
    if (err != SQLITE_OK) {
        throw_sqlite3_exception(env, connection->db, NULL);
    }
}

static void nativeBindLong(JNIEnv* env, jclass clazz, jlong connectionPtr,
        jlong statementPtr, jint index, jlong value) {
    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);
    sqlite3_stmt* statement = reinterpret_cast<sqlite3_stmt*>(statementPtr);

    int err = sqlite3_bind_int64(statement, index, value);
    if (err != SQLITE_OK) {
        throw_sqlite3_exception(env, connection->db, NULL);
    }
}

static void nativeBindDouble(JNIEnv* env, jclass clazz, jlong connectionPtr,
        jlong statementPtr, jint index, jdouble value) {
    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);
    sqlite3_stmt* statement = reinterpret_cast<sqlite3_stmt*>(statementPtr);

    int err = sqlite3_bind_double(statement, index, value);
    if (err != SQLITE_OK) {
        throw_sqlite3_exception(env, connection->db, NULL);
    }
}

static void nativeBindString(JNIEnv* env, jclass clazz, jlong connectionPtr,
        jlong statementPtr, jint index, jstring valueString) {
    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);
    sqlite3_stmt* statement = reinterpret_cast<sqlite3_stmt*>(statementPtr);

    jsize valueLength = env->GetStringLength(valueString);
    const jchar* value = env->GetStringCritical(valueString, NULL);
    int err = sqlite3_bind_text16(statement, index, value, valueLength * sizeof(jchar),
            SQLITE_TRANSIENT);
    env->ReleaseStringCritical(valueString, value);
    if (err != SQLITE_OK) {
        throw_sqlite3_exception(env, connection->db, NULL);
    }
}

static void nativeBindBlob(JNIEnv* env, jclass clazz, jlong connectionPtr,
        jlong statementPtr, jint index, jbyteArray valueArray) {
    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);
    sqlite3_stmt* statement = reinterpret_cast<sqlite3_stmt*>(statementPtr);

    jsize valueLength = env->GetArrayLength(valueArray);
    jbyte* value = static_cast<jbyte*>(env->GetPrimitiveArrayCritical(valueArray, NULL));
    int err = sqlite3_bind_blob(statement, index, value, valueLength, SQLITE_TRANSIENT);
    env->ReleasePrimitiveArrayCritical(valueArray, value, JNI_ABORT);
    if (err != SQLITE_OK) {
        throw_sqlite3_exception(env, connection->db, NULL);
    }
}

static void nativeResetStatementAndClearBindings(JNIEnv* env, jclass clazz, jlong connectionPtr,
        jlong statementPtr) {
    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);
    sqlite3_stmt* statement = reinterpret_cast<sqlite3_stmt*>(statementPtr);

    int err = sqlite3_reset(statement);
    if (err == SQLITE_OK) {
        err = sqlite3_clear_bindings(statement);
    }
    if (err != SQLITE_OK) {
        throw_sqlite3_exception(env, connection->db, NULL);
    }
}

static int executeNonQuery(JNIEnv* env, SQLiteConnection* connection, sqlite3_stmt* statement) {
    int err = sqlite3_step(statement);
    if (err == SQLITE_ROW) {
        throw_sqlite3_exception(env,
                "Queries can be performed using SQLiteDatabase query or rawQuery methods only.");
    } else if (err != SQLITE_DONE) {
        throw_sqlite3_exception(env, connection->db);
    }
    return err;
}

static void nativeExecute(JNIEnv* env, jclass clazz, jlong connectionPtr,
        jlong statementPtr) {
    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);
    sqlite3_stmt* statement = reinterpret_cast<sqlite3_stmt*>(statementPtr);

    executeNonQuery(env, connection, statement);
}

static jint nativeExecuteForChangedRowCount(JNIEnv* env, jclass clazz,
        jlong connectionPtr, jlong statementPtr) {
    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);
    sqlite3_stmt* statement = reinterpret_cast<sqlite3_stmt*>(statementPtr);

    int err = executeNonQuery(env, connection, statement);
    return err == SQLITE_DONE ? sqlite3_changes(connection->db) : -1;
}

static jlong nativeExecuteForLastInsertedRowId(JNIEnv* env, jclass clazz,
        jlong connectionPtr, jlong statementPtr) {
    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);
    sqlite3_stmt* statement = reinterpret_cast<sqlite3_stmt*>(statementPtr);

    int err = executeNonQuery(env, connection, statement);
    return err == SQLITE_DONE && sqlite3_changes(connection->db) > 0
            ? sqlite3_last_insert_rowid(connection->db) : -1;
}

static int executeOneRowQuery(JNIEnv* env, SQLiteConnection* connection, sqlite3_stmt* statement) {
    int err = sqlite3_step(statement);
    if (err != SQLITE_ROW) {
        throw_sqlite3_exception(env, connection->db);
    }
    return err;
}

static jlong nativeExecuteForLong(JNIEnv* env, jclass clazz,
        jlong connectionPtr, jlong statementPtr) {
    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);
    sqlite3_stmt* statement = reinterpret_cast<sqlite3_stmt*>(statementPtr);

    int err = executeOneRowQuery(env, connection, statement);
    if (err == SQLITE_ROW && sqlite3_column_count(statement) >= 1) {
        return sqlite3_column_int64(statement, 0);
    }
    return -1;
}

static jstring nativeExecuteForString(JNIEnv* env, jclass clazz,
        jlong connectionPtr, jlong statementPtr) {
    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);
    sqlite3_stmt* statement = reinterpret_cast<sqlite3_stmt*>(statementPtr);

    int err = executeOneRowQuery(env, connection, statement);
    if (err == SQLITE_ROW && sqlite3_column_count(statement) >= 1) {
        const jchar* text = static_cast<const jchar*>(sqlite3_column_text16(statement, 0));
        if (text) {
            size_t length = sqlite3_column_bytes16(statement, 0) / sizeof(jchar);
            return env->NewString(text, length);
        }
    }
    return NULL;
}

static int createAshmemRegionWithData(JNIEnv* env, const void* data, size_t length) {
#if 0
    int error = 0;
    int fd = ashmem_create_region(NULL, length);
    if (fd < 0) {
        error = errno;
        ALOGE("ashmem_create_region failed: %s", strerror(error));
    } else {
        if (length > 0) {
            void* ptr = mmap(NULL, length, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
            if (ptr == MAP_FAILED) {
                error = errno;
                ALOGE("mmap failed: %s", strerror(error));
            } else {
                memcpy(ptr, data, length);
                munmap(ptr, length);
            }
        }

        if (!error) {
            if (ashmem_set_prot_region(fd, PROT_READ) < 0) {
                error = errno;
                ALOGE("ashmem_set_prot_region failed: %s", strerror(errno));
            } else {
                return fd;
            }
        }

        close(fd);
    }

#endif
    jniThrowIOException(env, -1);
    return -1;
}

static jint nativeExecuteForBlobFileDescriptor(JNIEnv* env, jclass clazz,
        jlong connectionPtr, jlong statementPtr) {
    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);
    sqlite3_stmt* statement = reinterpret_cast<sqlite3_stmt*>(statementPtr);

    int err = executeOneRowQuery(env, connection, statement);
    if (err == SQLITE_ROW && sqlite3_column_count(statement) >= 1) {
        const void* blob = sqlite3_column_blob(statement, 0);
        if (blob) {
            int length = sqlite3_column_bytes(statement, 0);
            if (length >= 0) {
                return createAshmemRegionWithData(env, blob, length);
            }
        }
    }
    return -1;
}

enum CopyRowResult {
    CPR_OK,
    CPR_FULL,
    CPR_ERROR,
};

static CopyRowResult copyRow(JNIEnv* env, CursorWindow* window,
        sqlite3_stmt* statement, int numColumns, int startPos, int addedRows) {
    // Allocate a new field directory for the row.
    status_t status = window->allocRow();
    if (status) {
        LOG_WINDOW("Failed allocating fieldDir at startPos %d row %d, error=%d",
                startPos, addedRows, status);
        return CPR_FULL;
    }

    // Pack the row into the window.
    CopyRowResult result = CPR_OK;
    for (int i = 0; i < numColumns; i++) {
        int type = sqlite3_column_type(statement, i);
        if (type == SQLITE_TEXT) {
            // TEXT data
            const char* text = reinterpret_cast<const char*>(
                    sqlite3_column_text(statement, i));
            // SQLite does not include the NULL terminator in size, but does
            // ensure all strings are NULL terminated, so increase size by
            // one to make sure we store the terminator.
            size_t sizeIncludingNull = sqlite3_column_bytes(statement, i) + 1;
            status = window->putString(addedRows, i, text, sizeIncludingNull);
            if (status) {
                LOG_WINDOW("Failed allocating %u bytes for text at %d,%d, error=%d",
                        sizeIncludingNull, startPos + addedRows, i, status);
                result = CPR_FULL;
                break;
            }
            LOG_WINDOW("%d,%d is TEXT with %u bytes",
                    startPos + addedRows, i, sizeIncludingNull);
        } else if (type == SQLITE_INTEGER) {
            // INTEGER data
            int64_t value = sqlite3_column_int64(statement, i);
            status = window->putLong(addedRows, i, value);
            if (status) {
                LOG_WINDOW("Failed allocating space for a long in column %d, error=%d",
                        i, status);
                result = CPR_FULL;
                break;
            }
            LOG_WINDOW("%d,%d is INTEGER 0x%016llx", startPos + addedRows, i, value);
        } else if (type == SQLITE_FLOAT) {
            // FLOAT data
            double value = sqlite3_column_double(statement, i);
            status = window->putDouble(addedRows, i, value);
            if (status) {
                LOG_WINDOW("Failed allocating space for a double in column %d, error=%d",
                        i, status);
                result = CPR_FULL;
                break;
            }
            LOG_WINDOW("%d,%d is FLOAT %lf", startPos + addedRows, i, value);
        } else if (type == SQLITE_BLOB) {
            // BLOB data
            const void* blob = sqlite3_column_blob(statement, i);
            size_t size = sqlite3_column_bytes(statement, i);
            status = window->putBlob(addedRows, i, blob, size);
            if (status) {
                LOG_WINDOW("Failed allocating %u bytes for blob at %d,%d, error=%d",
                        size, startPos + addedRows, i, status);
                result = CPR_FULL;
                break;
            }
            LOG_WINDOW("%d,%d is Blob with %u bytes",
                    startPos + addedRows, i, size);
        } else if (type == SQLITE_NULL) {
            // NULL field
            status = window->putNull(addedRows, i);
            if (status) {
                LOG_WINDOW("Failed allocating space for a null in column %d, error=%d",
                        i, status);
                result = CPR_FULL;
                break;
            }

            LOG_WINDOW("%d,%d is NULL", startPos + addedRows, i);
        } else {
            // Unknown data
            ALOGE("Unknown column type when filling database window");
            throw_sqlite3_exception(env, "Unknown column type when filling window");
            result = CPR_ERROR;
            break;
        }
    }

    // Free the last row if if was not successfully copied.
    if (result != CPR_OK) {
        window->freeLastRow();
    }
    return result;
}

static jlong nativeExecuteForCursorWindow(JNIEnv* env, jclass clazz,
        jlong connectionPtr, jlong statementPtr, jlong windowPtr,
        jint startPos, jint requiredPos, jboolean countAllRows) {
    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);
    sqlite3_stmt* statement = reinterpret_cast<sqlite3_stmt*>(statementPtr);
    CursorWindow* window = reinterpret_cast<CursorWindow*>(windowPtr);

    status_t status = window->clear();
    if (status) {
        throw_sqlite3_exception(env, connection->db, "Failed to clear the cursor window");
        return 0;
    }

    int numColumns = sqlite3_column_count(statement);
    status = window->setNumColumns(numColumns);
    if (status) {
        throw_sqlite3_exception(env, connection->db, "Failed to set the cursor window column count");
        return 0;
    }

    int retryCount = 0;
    int totalRows = 0;
    int addedRows = 0;
    bool windowFull = false;
    bool gotException = false;
    while (!gotException && (!windowFull || countAllRows)) {
        int err = sqlite3_step(statement);
        if (err == SQLITE_ROW) {
            LOG_WINDOW("Stepped statement %p to row %d", statement, totalRows);
            retryCount = 0;
            totalRows += 1;

            // Skip the row if the window is full or we haven't reached the start position yet.
            if (startPos >= totalRows || windowFull) {
                continue;
            }

            CopyRowResult cpr = copyRow(env, window, statement, numColumns, startPos, addedRows);
            if (cpr == CPR_FULL && addedRows && startPos + addedRows <= requiredPos) {
                // We filled the window before we got to the one row that we really wanted.
                // Clear the window and start filling it again from here.
                // TODO: Would be nicer if we could progressively replace earlier rows.
                window->clear();
                window->setNumColumns(numColumns);
                startPos += addedRows;
                addedRows = 0;
                cpr = copyRow(env, window, statement, numColumns, startPos, addedRows);
            }

            if (cpr == CPR_OK) {
                addedRows += 1;
            } else if (cpr == CPR_FULL) {
                windowFull = true;
            } else {
                gotException = true;
            }
        } else if (err == SQLITE_DONE) {
            // All rows processed, bail
            LOG_WINDOW("Processed all rows");
            break;
        } else if (err == SQLITE_LOCKED || err == SQLITE_BUSY) {
            // The table is locked, retry
            LOG_WINDOW("Database locked, retrying");
            if (retryCount > 50) {
                ALOGE("Bailing on database busy retry");
                throw_sqlite3_exception(env, connection->db, "retrycount exceeded");
                gotException = true;
            } else {
                // Sleep to give the thread holding the lock a chance to finish
                usleep(1000);
                retryCount++;
            }
        } else {
            throw_sqlite3_exception(env, connection->db);
            gotException = true;
        }
    }

    LOG_WINDOW("Resetting statement %p after fetching %d rows and adding %d rows"
            "to the window in %d bytes",
            statement, totalRows, addedRows, window->size() - window->freeSpace());
    sqlite3_reset(statement);

    // Report the total number of rows on request.
    if (startPos > totalRows) {
        ALOGE("startPos %d > actual rows %d", startPos, totalRows);
    }
    jlong result = jlong(startPos) << 32 | jlong(totalRows);
    return result;
}

static jint nativeGetDbLookaside(JNIEnv* env, jobject clazz, jlong connectionPtr) {
    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);

    int cur = -1;
    int unused;
    sqlite3_db_status(connection->db, SQLITE_DBSTATUS_LOOKASIDE_USED, &cur, &unused, 0);
    return cur;
}

static void nativeCancel(JNIEnv* env, jobject clazz, jlong connectionPtr) {
    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);
    connection->canceled = true;
}

static void nativeResetCancel(JNIEnv* env, jobject clazz, jlong connectionPtr,
        jboolean cancelable) {
    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);
    connection->canceled = false;

    if (cancelable) {
        sqlite3_progress_handler(connection->db, 4, sqliteProgressHandlerCallback,
                connection);
    } else {
        sqlite3_progress_handler(connection->db, 0, NULL, NULL);
    }
}

static jboolean nativeHasCodec(JNIEnv* env, jobject clazz){
#ifdef SQLITE_HAS_CODEC
  return true;
#else
  return false;
#endif
}

static void nativeLoadExtension(JNIEnv* env, jobject clazz,
                                jlong connectionPtr, jstring file, jstring proc) {
    char* errorMessage;

    SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(connectionPtr);
    int result = sqlite3_enable_load_extension(connection->db, 1);
    if (result == SQLITE_OK) {
        const char* fileChars = env->GetStringUTFChars(file, NULL);
        const char* procChars = NULL;
        if (proc) {
            procChars = env->GetStringUTFChars(proc, NULL);
        }
        result = sqlite3_load_extension(connection->db, fileChars, procChars, &errorMessage);
        env->ReleaseStringUTFChars(file, fileChars);
        if (proc) {
            env->ReleaseStringUTFChars(proc, procChars);
        }
    }
    if (result != SQLITE_OK) {
        char* formattedError = sqlite3_mprintf("Could not register extension: %s", errorMessage);
        sqlite3_free(errorMessage);

        throw_sqlite3_exception_errcode(env, result, formattedError);
        sqlite3_free(formattedError);
    }
}

static JNINativeMethod sMethods[] =
{
    /* name, signature, funcPtr */
    { "nativeOpen", "(Ljava/lang/String;ILjava/lang/String;ZZ)J",
            (void*)nativeOpen },
    { "nativeClose", "(J)V",
            (void*)nativeClose },
    { "nativeRegisterCustomFunction", "(JLio/requery/android/database/sqlite/SQLiteCustomFunction;)V",
            (void*)nativeRegisterCustomFunction },
    { "nativeRegisterFunction", "(JLio/requery/android/database/sqlite/SQLiteFunction;)V",
            (void*)nativeRegisterFunction },
    { "nativeRegisterLocalizedCollators", "(JLjava/lang/String;)V",
            (void*)nativeRegisterLocalizedCollators },
    { "nativePrepareStatement", "(JLjava/lang/String;)J",
            (void*)nativePrepareStatement },
    { "nativeFinalizeStatement", "(JJ)V",
            (void*)nativeFinalizeStatement },
    { "nativeGetParameterCount", "(JJ)I",
            (void*)nativeGetParameterCount },
    { "nativeIsReadOnly", "(JJ)Z",
            (void*)nativeIsReadOnly },
    { "nativeGetColumnCount", "(JJ)I",
            (void*)nativeGetColumnCount },
    { "nativeGetColumnName", "(JJI)Ljava/lang/String;",
            (void*)nativeGetColumnName },
    { "nativeBindNull", "(JJI)V",
            (void*)nativeBindNull },
    { "nativeBindLong", "(JJIJ)V",
            (void*)nativeBindLong },
    { "nativeBindDouble", "(JJID)V",
            (void*)nativeBindDouble },
    { "nativeBindString", "(JJILjava/lang/String;)V",
            (void*)nativeBindString },
    { "nativeBindBlob", "(JJI[B)V",
            (void*)nativeBindBlob },
    { "nativeResetStatementAndClearBindings", "(JJ)V",
            (void*)nativeResetStatementAndClearBindings },
    { "nativeExecute", "(JJ)V",
            (void*)nativeExecute },
    { "nativeExecuteForLong", "(JJ)J",
            (void*)nativeExecuteForLong },
    { "nativeExecuteForString", "(JJ)Ljava/lang/String;",
            (void*)nativeExecuteForString },
    { "nativeExecuteForBlobFileDescriptor", "(JJ)I",
            (void*)nativeExecuteForBlobFileDescriptor },
    { "nativeExecuteForChangedRowCount", "(JJ)I",
            (void*)nativeExecuteForChangedRowCount },
    { "nativeExecuteForLastInsertedRowId", "(JJ)J",
            (void*)nativeExecuteForLastInsertedRowId },
    { "nativeExecuteForCursorWindow", "(JJJIIZ)J",
            (void*)nativeExecuteForCursorWindow },
    { "nativeGetDbLookaside", "(J)I",
            (void*)nativeGetDbLookaside },
    { "nativeCancel", "(J)V",
            (void*)nativeCancel },
    { "nativeResetCancel", "(JZ)V",
            (void*)nativeResetCancel },
    { "nativeHasCodec", "()Z",
            (void*)nativeHasCodec },
    { "nativeLoadExtension", "(JLjava/lang/String;Ljava/lang/String;)V",
            (void*)nativeLoadExtension },
    { "nativeRegisterUpdateHook", "(JLio/requery/android/database/sqlite/SQLiteUpdateHook;)V",
            (void*)nativeRegisterUpdateHook },
};

int register_android_database_SQLiteConnection(JNIEnv *env)
{
    jclass clazz;
    FIND_CLASS(clazz, "io/requery/android/database/sqlite/SQLiteCustomFunction");

    GET_FIELD_ID(gSQLiteCustomFunctionClassInfo.name, clazz,
            "name", "Ljava/lang/String;");
    GET_FIELD_ID(gSQLiteCustomFunctionClassInfo.numArgs, clazz,
            "numArgs", "I");
    GET_METHOD_ID(gSQLiteCustomFunctionClassInfo.dispatchCallback,
            clazz, "dispatchCallback", "([Ljava/lang/String;)Ljava/lang/String;");

    FIND_CLASS(clazz, "io/requery/android/database/sqlite/SQLiteFunction");

    GET_FIELD_ID(gSQLiteFunctionClassInfo.name, clazz,
            "name", "Ljava/lang/String;");
    GET_FIELD_ID(gSQLiteFunctionClassInfo.numArgs, clazz,
            "numArgs", "I");
    GET_FIELD_ID(gSQLiteFunctionClassInfo.flags, clazz,
            "flags", "I");
    GET_METHOD_ID(gSQLiteFunctionClassInfo.dispatchCallback,
            clazz, "dispatchCallback", "(JJI)V");

    FIND_CLASS(clazz, "java/lang/String");
    gStringClassInfo.clazz = jclass(env->NewGlobalRef(clazz));

    return jniRegisterNativeMethods(env,
        "io/requery/android/database/sqlite/SQLiteConnection",
        sMethods, NELEM(sMethods)
    );
}

extern int register_android_database_SQLiteGlobal(JNIEnv *env);
extern int register_android_database_SQLiteDebug(JNIEnv *env);
extern int register_android_database_SQLiteFunction(JNIEnv *env);
extern int register_android_database_CursorWindow(JNIEnv *env);

} // namespace android

extern "C" JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void* reserved) {
  JNIEnv *env = 0;

  android::gpJavaVM = vm;
  vm->GetEnv((void**)&env, JNI_VERSION_1_4);

  android::register_android_database_SQLiteConnection(env);
  android::register_android_database_SQLiteDebug(env);
  android::register_android_database_SQLiteGlobal(env);
  android::register_android_database_CursorWindow(env);
  android::register_android_database_SQLiteFunction(env);

  return JNI_VERSION_1_4;
}



