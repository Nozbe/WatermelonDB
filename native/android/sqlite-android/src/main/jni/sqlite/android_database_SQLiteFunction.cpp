#define LOG_TAG "SQLiteFunction"

#include <jni.h>
#include <sys/mman.h>
#include <string.h>
#include <unistd.h>
#include <assert.h>

#include "sqlite3.h"
#include "JNIHelp.h"
#include "ALog-priv.h"
#include "android_database_SQLiteCommon.h"

namespace android {

/* Returns the sqlite3_value for the given arg of the given function.
 * If 0 is returned, an exception has been thrown to report the reason. */
static sqlite3_value *tovalue(JNIEnv *env, jlong argsPtr, jint arg) {
    if (arg < 0) {
        throw_sqlite3_exception(env, "Invalid arg index");
        return 0;
    }
    if (!argsPtr) {
        throw_sqlite3_exception(env, "Invalid argsPtr");
        return 0;
    }

    sqlite3_value **args = reinterpret_cast<sqlite3_value**>(argsPtr);
    return args[arg];
}

static sqlite3_context *tocontext(JNIEnv *env, jlong contextPtr) {
    if (!contextPtr) {
        throw_sqlite3_exception(env, "Invalid contextPtr");
        return 0;
    }

    return reinterpret_cast<sqlite3_context*>(contextPtr);
}

/*
 * Getters
 */

static jbyteArray nativeGetArgBlob(JNIEnv* env, jclass clazz, jlong argsPtr,
        jint arg) {
    int length;
    jbyteArray byteArray;
    const void *blob;

    sqlite3_value *value = tovalue(env, argsPtr, arg);
    if (!value) return NULL;

    blob = sqlite3_value_blob(value);
    if (!blob) return NULL;

    length = sqlite3_value_bytes(value);
    byteArray = env->NewByteArray(length);
    if (!byteArray) {
        env->ExceptionClear();
        throw_sqlite3_exception(env, "Native could not create new byte[]");
        return NULL;
    }

    env->SetByteArrayRegion(byteArray, 0, length, static_cast<const jbyte*>(blob));
    return byteArray;
}

static jstring nativeGetArgString(JNIEnv* env, jclass clazz, jlong argsPtr,
        jint arg) {
    sqlite3_value *value = tovalue(env, argsPtr, arg);
    if (!value) return NULL;

    const jchar* chars = static_cast<const jchar*>(sqlite3_value_text16(value));
    if (!chars) return NULL;

    size_t len = sqlite3_value_bytes16(value) / sizeof(jchar);
    jstring str = env->NewString(chars, len);
    if (!str) {
        env->ExceptionClear();
        throw_sqlite3_exception(env, "Native could not allocate string");
        return NULL;
    }

    return str;
}

static jlong nativeGetArgLong(JNIEnv* env, jclass clazz, jlong argsPtr,
        jint arg) {
    sqlite3_value *value = tovalue(env, argsPtr, arg);
    return value ? sqlite3_value_int64(value) : 0;
}

static jdouble nativeGetArgDouble(JNIEnv* env, jclass clazz, jlong argsPtr,
        jint arg) {
    sqlite3_value *value = tovalue(env, argsPtr, arg);
    return value ? sqlite3_value_double(value) : 0;
}

static jint nativeGetArgInt(JNIEnv* env, jclass clazz, jlong argsPtr,
        jint arg) {
    sqlite3_value *value = tovalue(env, argsPtr, arg);
    return value ? sqlite3_value_int(value) : 0;
}

/*
 * Setters
 */

static void nativeSetResultBlob(JNIEnv* env, jclass clazz,
        jlong contextPtr, jbyteArray result) {
    sqlite3_context *context = tocontext(env, contextPtr);
    if (!context) return;
    if (result == NULL) {
        sqlite3_result_null(context);
        return;
    }

    jsize len = env->GetArrayLength(result);
    void *bytes = env->GetPrimitiveArrayCritical(result, NULL);
    if (!bytes) {
        env->ExceptionClear();
        throw_sqlite3_exception(env, "Out of memory accepting blob");
        return;
    }

    sqlite3_result_blob(context, bytes, len, SQLITE_TRANSIENT);
    env->ReleasePrimitiveArrayCritical(result, bytes, JNI_ABORT);
}

static void nativeSetResultString(JNIEnv* env, jclass clazz,
        jlong contextPtr, jstring result) {
    sqlite3_context *context = tocontext(env, contextPtr);
    if (result == NULL) {
        sqlite3_result_null(context);
        return;
    }

    const char* chars = env->GetStringUTFChars(result, NULL);
    if (!chars) {
        ALOGE("result value can't be transferred to UTFChars");
        sqlite3_result_error_nomem(context);
        return;
    }

    sqlite3_result_text(context, chars, -1, SQLITE_TRANSIENT);
    env->ReleaseStringUTFChars(result, chars);
}

static void nativeSetResultLong(JNIEnv* env, jclass clazz,
        jlong contextPtr, jlong result) {
    sqlite3_context *context = tocontext(env, contextPtr);
    if (context) sqlite3_result_int64(context, result);
}

static void nativeSetResultDouble(JNIEnv* env, jclass clazz,
        jlong contextPtr, jdouble result) {
    sqlite3_context *context = tocontext(env, contextPtr);
    if (context) sqlite3_result_double(context, result);
}

static void nativeSetResultInt(JNIEnv* env, jclass clazz,
        jlong contextPtr, jint result) {
    sqlite3_context *context = tocontext(env, contextPtr);
    if (context) sqlite3_result_int(context, result);
}

static void nativeSetResultError(JNIEnv* env, jclass clazz,
        jlong contextPtr, jstring error) {
    sqlite3_context *context = tocontext(env, contextPtr);
    if (error == NULL) {
        sqlite3_result_null(context);
        return;
    }

    const char* chars = env->GetStringUTFChars(error, NULL);
    if (!chars) {
        ALOGE("result value can't be transferred to UTFChars");
        sqlite3_result_error_nomem(context);
        return;
    }

    sqlite3_result_error(context, chars, -1);
    env->ReleaseStringUTFChars(error, chars);
}

static void nativeSetResultNull(JNIEnv* env, jclass clazz, jlong contextPtr) {
    sqlite3_context *context = tocontext(env, contextPtr);
    if (context) sqlite3_result_null(context);
}


static const JNINativeMethod sMethods[] =
{
    /* name, signature, funcPtr */
    { "nativeGetArgBlob", "(JI)[B",
            (void*)nativeGetArgBlob },
    { "nativeGetArgString", "(JI)Ljava/lang/String;",
            (void*)nativeGetArgString },
    { "nativeGetArgLong", "(JI)J",
            (void*)nativeGetArgLong },
    { "nativeGetArgDouble", "(JI)D",
            (void*)nativeGetArgDouble },
    { "nativeGetArgInt", "(JI)I",
            (void*)nativeGetArgInt },

    { "nativeSetResultBlob", "(J[B)V",
            (void*)nativeSetResultBlob },
    { "nativeSetResultString", "(JLjava/lang/String;)V",
            (void*)nativeSetResultString },
    { "nativeSetResultLong", "(JJ)V",
            (void*)nativeSetResultLong },
    { "nativeSetResultDouble", "(JD)V",
            (void*)nativeSetResultDouble },
    { "nativeSetResultInt", "(JI)V",
            (void*)nativeSetResultInt },
    { "nativeSetResultError", "(JLjava/lang/String;)V",
            (void*)nativeSetResultError },
    { "nativeSetResultNull", "(J)V",
            (void*)nativeSetResultNull },
};

int register_android_database_SQLiteFunction(JNIEnv* env)
{
    return jniRegisterNativeMethods(env,
        "io/requery/android/database/sqlite/SQLiteFunction", sMethods, NELEM(sMethods));
}

} // namespace android
