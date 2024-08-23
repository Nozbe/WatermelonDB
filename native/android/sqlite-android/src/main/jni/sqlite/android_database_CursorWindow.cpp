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

#undef LOG_TAG
#define LOG_TAG "CursorWindow"
#define __STDC_FORMAT_MACROS

#include <inttypes.h>
#include <jni.h>
#include <JNIHelp.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

#include "CursorWindow.h"
#include "android_database_SQLiteCommon.h"

namespace android {

static struct {
    jfieldID data;
    jfieldID sizeCopied;
} gCharArrayBufferClassInfo;

static jstring gEmptyString = NULL;

static void throwExceptionWithRowCol(JNIEnv* env, jint row, jint column) {
    char buf[64];
    snprintf(buf, sizeof(buf), "Couldn't read row %d column %d", row, column);
    jniThrowException(env, "java/lang/IllegalStateException", buf);
}

static void throwUnknownTypeException(JNIEnv * env, jint type) {
    char buf[32];
    snprintf(buf, sizeof(buf), "UNKNOWN type %d", type);
    jniThrowException(env, "java/lang/IllegalStateException", buf);
}

static jlong nativeCreate(JNIEnv* env, jclass clazz, jstring nameObj, jint cursorWindowSize) {
    CursorWindow* window;
    const char* nameStr = env->GetStringUTFChars(nameObj, NULL);
    status_t status = CursorWindow::create(nameStr, cursorWindowSize, &window);
    env->ReleaseStringUTFChars(nameObj, nameStr);

    if (status || !window) {
        ALOGE("Could not allocate CursorWindow of size %d due to error %d.",
        cursorWindowSize, status);
        return 0;
    }

    LOG_WINDOW("nativeInitializeEmpty: window = %p", window);
    return reinterpret_cast<jlong>(window);
}

static void nativeDispose(JNIEnv* env, jclass clazz, jlong windowPtr) {
    CursorWindow* window = reinterpret_cast<CursorWindow*>(windowPtr);
    if (window) {
        LOG_WINDOW("Closing window %p", window);
        delete window;
    }
}

static jstring nativeGetName(JNIEnv* env, jclass clazz, jlong windowPtr) {
    CursorWindow* window = reinterpret_cast<CursorWindow*>(windowPtr);
    return env->NewStringUTF(window->name());
}

static void nativeClear(JNIEnv * env, jclass clazz, jlong windowPtr) {
    CursorWindow* window = reinterpret_cast<CursorWindow*>(windowPtr);
    LOG_WINDOW("Clearing window %p", window);
    status_t status = window->clear();
    if (status) {
        LOG_WINDOW("Could not clear window. error=%d", status);
    }
}

static jint nativeGetNumRows(JNIEnv* env, jclass clazz, jlong windowPtr) {
    CursorWindow* window = reinterpret_cast<CursorWindow*>(windowPtr);
    return window->getNumRows();
}

static jboolean nativeSetNumColumns(JNIEnv* env, jclass clazz, jlong windowPtr,
        jint columnNum) {
    CursorWindow* window = reinterpret_cast<CursorWindow*>(windowPtr);
    status_t status = window->setNumColumns(columnNum);
    return status == OK;
}

static jboolean nativeAllocRow(JNIEnv* env, jclass clazz, jlong windowPtr) {
    CursorWindow* window = reinterpret_cast<CursorWindow*>(windowPtr);
    status_t status = window->allocRow();
    return status == OK;
}

static void nativeFreeLastRow(JNIEnv* env, jclass clazz, jlong windowPtr) {
    CursorWindow* window = reinterpret_cast<CursorWindow*>(windowPtr);
    window->freeLastRow();
}

static jint nativeGetType(JNIEnv* env, jclass clazz, jlong windowPtr,
        jint row, jint column) {
    CursorWindow* window = reinterpret_cast<CursorWindow*>(windowPtr);
    LOG_WINDOW("returning column type affinity for %d,%d from %p", row, column, window);

    CursorWindow::FieldSlot* fieldSlot = window->getFieldSlot(row, column);
    if (!fieldSlot) {
        return CursorWindow::FIELD_TYPE_NULL;
    }
    return window->getFieldSlotType(fieldSlot);
}

static jbyteArray nativeGetBlob(JNIEnv* env, jclass clazz, jlong windowPtr,
        jint row, jint column) {
    CursorWindow* window = reinterpret_cast<CursorWindow*>(windowPtr);
    //LOG_WINDOW("Getting blob for %d,%d from %p", row, column, window);

    CursorWindow::FieldSlot* fieldSlot = window->getFieldSlot(row, column);
    if (!fieldSlot) {
        throwExceptionWithRowCol(env, row, column);
        return NULL;
    }

    int32_t type = window->getFieldSlotType(fieldSlot);
    if (type == CursorWindow::FIELD_TYPE_BLOB || type == CursorWindow::FIELD_TYPE_STRING) {
        size_t size;
        const void* value = window->getFieldSlotValueBlob(fieldSlot, &size);
        jbyteArray byteArray = env->NewByteArray(size);
        if (!byteArray) {
            env->ExceptionClear();
            throw_sqlite3_exception(env, "Native could not create new byte[]");
            return NULL;
        }
        env->SetByteArrayRegion(byteArray, 0, size, static_cast<const jbyte*>(value));
        return byteArray;
    } else if (type == CursorWindow::FIELD_TYPE_INTEGER) {
        throw_sqlite3_exception(env, "INTEGER data in nativeGetBlob ");
    } else if (type == CursorWindow::FIELD_TYPE_FLOAT) {
        throw_sqlite3_exception(env, "FLOAT data in nativeGetBlob ");
    } else if (type == CursorWindow::FIELD_TYPE_NULL) {
        // do nothing
    } else {
        throwUnknownTypeException(env, type);
    }
    return NULL;
}

extern int utf8ToJavaCharArray(const char* d, jchar v[], jint byteCount);

static jstring nativeGetString(JNIEnv* env, jclass clazz, jlong windowPtr,
        jint row, jint column) {
    CursorWindow* window = reinterpret_cast<CursorWindow*>(windowPtr);
    //LOG_WINDOW("Getting string for %d,%d from %p", row, column, window);

    CursorWindow::FieldSlot* fieldSlot = window->getFieldSlot(row, column);
    if (!fieldSlot) {
        throwExceptionWithRowCol(env, row, column);
        return NULL;
    }

    int32_t type = window->getFieldSlotType(fieldSlot);
    if (type == CursorWindow::FIELD_TYPE_STRING) {
        size_t sizeIncludingNull;
        const char* value = window->getFieldSlotValueString(fieldSlot, &sizeIncludingNull);
        if (sizeIncludingNull <= 1) {
            return gEmptyString;
        }
        const size_t MaxStackStringSize = 65536; // max size for a stack char array
        if (sizeIncludingNull > MaxStackStringSize) {
            jchar* chars = new jchar[sizeIncludingNull - 1];
            jint size = utf8ToJavaCharArray(value, chars, sizeIncludingNull - 1);
            jstring string = env->NewString(chars, size);
            delete[] chars;
            return string;
        } else {
            jchar chars[sizeIncludingNull - 1];
            jint size = utf8ToJavaCharArray(value, chars, sizeIncludingNull - 1);
            return env->NewString(chars, size);
        }
    } else if (type == CursorWindow::FIELD_TYPE_INTEGER) {
        int64_t value = window->getFieldSlotValueLong(fieldSlot);
        char buf[32];
        snprintf(buf, sizeof(buf), "%" PRId64, value);
        return env->NewStringUTF(buf);
    } else if (type == CursorWindow::FIELD_TYPE_FLOAT) {
        double value = window->getFieldSlotValueDouble(fieldSlot);
        char buf[32];
        snprintf(buf, sizeof(buf), "%g", value);
        return env->NewStringUTF(buf);
    } else if (type == CursorWindow::FIELD_TYPE_NULL) {
        return NULL;
    } else if (type == CursorWindow::FIELD_TYPE_BLOB) {
        throw_sqlite3_exception(env, "Unable to convert BLOB to string");
        return NULL;
    } else {
        throwUnknownTypeException(env, type);
        return NULL;
    }
}

static jlong nativeGetLong(JNIEnv* env, jclass clazz, jlong windowPtr,
        jint row, jint column) {
    CursorWindow* window = reinterpret_cast<CursorWindow*>(windowPtr);
    //LOG_WINDOW("Getting long for %d,%d from %p", row, column, window);

    CursorWindow::FieldSlot* fieldSlot = window->getFieldSlot(row, column);
    if (!fieldSlot) {
        throwExceptionWithRowCol(env, row, column);
        return 0;
    }

    int32_t type = window->getFieldSlotType(fieldSlot);
    if (type == CursorWindow::FIELD_TYPE_INTEGER) {
        return window->getFieldSlotValueLong(fieldSlot);
    } else if (type == CursorWindow::FIELD_TYPE_STRING) {
        size_t sizeIncludingNull;
        const char* value = window->getFieldSlotValueString(fieldSlot, &sizeIncludingNull);
        return sizeIncludingNull > 1 ? strtoll(value, NULL, 0) : 0L;
    } else if (type == CursorWindow::FIELD_TYPE_FLOAT) {
        return jlong(window->getFieldSlotValueDouble(fieldSlot));
    } else if (type == CursorWindow::FIELD_TYPE_NULL) {
        return 0;
    } else if (type == CursorWindow::FIELD_TYPE_BLOB) {
        throw_sqlite3_exception(env, "Unable to convert BLOB to long");
        return 0;
    } else {
        throwUnknownTypeException(env, type);
        return 0;
    }
}

static jdouble nativeGetDouble(JNIEnv* env, jclass clazz, jlong windowPtr,
        jint row, jint column) {
    CursorWindow* window = reinterpret_cast<CursorWindow*>(windowPtr);
    //LOG_WINDOW("Getting double for %d,%d from %p", row, column, window);

    CursorWindow::FieldSlot* fieldSlot = window->getFieldSlot(row, column);
    if (!fieldSlot) {
        throwExceptionWithRowCol(env, row, column);
        return 0.0;
    }

    int32_t type = window->getFieldSlotType(fieldSlot);
    if (type == CursorWindow::FIELD_TYPE_FLOAT) {
        return window->getFieldSlotValueDouble(fieldSlot);
    } else if (type == CursorWindow::FIELD_TYPE_STRING) {
        size_t sizeIncludingNull;
        const char* value = window->getFieldSlotValueString(fieldSlot, &sizeIncludingNull);
        return sizeIncludingNull > 1 ? strtod(value, NULL) : 0.0;
    } else if (type == CursorWindow::FIELD_TYPE_INTEGER) {
        return jdouble(window->getFieldSlotValueLong(fieldSlot));
    } else if (type == CursorWindow::FIELD_TYPE_NULL) {
        return 0.0;
    } else if (type == CursorWindow::FIELD_TYPE_BLOB) {
        throw_sqlite3_exception(env, "Unable to convert BLOB to double");
        return 0.0;
    } else {
        throwUnknownTypeException(env, type);
        return 0.0;
    }
}

static jboolean nativePutBlob(JNIEnv* env, jclass clazz, jlong windowPtr,
        jbyteArray valueObj, jint row, jint column) {
    CursorWindow* window = reinterpret_cast<CursorWindow*>(windowPtr);
    jsize len = env->GetArrayLength(valueObj);

    void* value = env->GetPrimitiveArrayCritical(valueObj, NULL);
    status_t status = window->putBlob(row, column, value, len);
    env->ReleasePrimitiveArrayCritical(valueObj, value, JNI_ABORT);

    if (status) {
        LOG_WINDOW("Failed to put blob. error=%d", status);
        return false;
    }

    LOG_WINDOW("%d,%d is BLOB with %u bytes", row, column, len);
    return true;
}

static jboolean nativePutString(JNIEnv* env, jclass clazz, jlong windowPtr,
        jstring valueObj, jint row, jint column) {
    CursorWindow* window = reinterpret_cast<CursorWindow*>(windowPtr);

    size_t sizeIncludingNull = env->GetStringUTFLength(valueObj) + 1;
    const char* valueStr = env->GetStringUTFChars(valueObj, NULL);
    if (!valueStr) {
        LOG_WINDOW("value can't be transferred to UTFChars");
        return false;
    }
    status_t status = window->putString(row, column, valueStr, sizeIncludingNull);
    env->ReleaseStringUTFChars(valueObj, valueStr);

    if (status) {
        LOG_WINDOW("Failed to put string. error=%d", status);
        return false;
    }

    LOG_WINDOW("%d,%d is TEXT with %u bytes", row, column, sizeIncludingNull);
    return true;
}

static jboolean nativePutLong(JNIEnv* env, jclass clazz, jlong windowPtr,
        jlong value, jint row, jint column) {
    CursorWindow* window = reinterpret_cast<CursorWindow*>(windowPtr);
    status_t status = window->putLong(row, column, value);

    if (status) {
        LOG_WINDOW("Failed to put long. error=%d", status);
        return false;
    }

    LOG_WINDOW("%d,%d is INTEGER 0x%016llx", row, column, value);
    return true;
}

static jboolean nativePutDouble(JNIEnv* env, jclass clazz, jlong windowPtr,
        jdouble value, jint row, jint column) {
    CursorWindow* window = reinterpret_cast<CursorWindow*>(windowPtr);
    status_t status = window->putDouble(row, column, value);

    if (status) {
        LOG_WINDOW("Failed to put double. error=%d", status);
        return false;
    }

    LOG_WINDOW("%d,%d is FLOAT %lf", row, column, value);
    return true;
}

static jboolean nativePutNull(JNIEnv* env, jclass clazz, jlong windowPtr,
        jint row, jint column) {
    CursorWindow* window = reinterpret_cast<CursorWindow*>(windowPtr);
    status_t status = window->putNull(row, column);

    if (status) {
        LOG_WINDOW("Failed to put null. error=%d", status);
        return false;
    }

    LOG_WINDOW("%d,%d is NULL", row, column);
    return true;
}

static const JNINativeMethod sMethods[] =
{
    /* name, signature, funcPtr */
    { "nativeCreate", "(Ljava/lang/String;I)J",
            (void*)nativeCreate },
    { "nativeDispose", "(J)V",
            (void*)nativeDispose },
    { "nativeGetName", "(J)Ljava/lang/String;",
            (void*)nativeGetName },
    { "nativeClear", "(J)V",
            (void*)nativeClear },
    { "nativeGetNumRows", "(J)I",
            (void*)nativeGetNumRows },
    { "nativeSetNumColumns", "(JI)Z",
            (void*)nativeSetNumColumns },
    { "nativeAllocRow", "(J)Z",
            (void*)nativeAllocRow },
    { "nativeFreeLastRow", "(J)V",
            (void*)nativeFreeLastRow },
    { "nativeGetType", "(JII)I",
            (void*)nativeGetType },
    { "nativeGetBlob", "(JII)[B",
            (void*)nativeGetBlob },
    { "nativeGetString", "(JII)Ljava/lang/String;",
            (void*)nativeGetString },
    { "nativeGetLong", "(JII)J",
            (void*)nativeGetLong },
    { "nativeGetDouble", "(JII)D",
            (void*)nativeGetDouble },
    { "nativePutBlob", "(J[BII)Z",
            (void*)nativePutBlob },
    { "nativePutString", "(JLjava/lang/String;II)Z",
            (void*)nativePutString },
    { "nativePutLong", "(JJII)Z",
            (void*)nativePutLong },
    { "nativePutDouble", "(JDII)Z",
            (void*)nativePutDouble },
    { "nativePutNull", "(JII)Z",
            (void*)nativePutNull },
};

int register_android_database_CursorWindow(JNIEnv* env)
{
    jclass clazz;
    FIND_CLASS(clazz, "android/database/CharArrayBuffer");

    GET_FIELD_ID(gCharArrayBufferClassInfo.data, clazz, "data", "[C");
    GET_FIELD_ID(gCharArrayBufferClassInfo.sizeCopied, clazz, "sizeCopied", "I");

    gEmptyString = static_cast<jstring>(env->NewGlobalRef(env->NewStringUTF("")));
    return jniRegisterNativeMethods(env,
    "io/requery/android/database/CursorWindow", sMethods, NELEM(sMethods));
}

} // namespace android
