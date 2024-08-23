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

/*
 * JNI helper functions.
 *
 * This file may be included by C or C++ code, which is trouble because jni.h
 * uses different typedefs for JNIEnv in each language.
 *
 * TODO: remove C support.
 */
#ifndef NATIVEHELPER_JNIHELP_H_
#define NATIVEHELPER_JNIHELP_H_

#include "jni.h"
#include <unistd.h>

#ifndef NELEM
# define NELEM(x) ((int) (sizeof(x) / sizeof((x)[0])))
#endif

#ifdef __cplusplus
extern "C" {
#endif

/*
 * Register one or more native methods with a particular class.
 * "className" looks like "java/lang/String". Aborts on failure.
 * TODO: fix all callers and change the return type to void.
 */
int jniRegisterNativeMethods(C_JNIEnv* env, const char* className, const JNINativeMethod* gMethods, int numMethods);

/*
 * Throw an exception with the specified class and an optional message.
 *
 * The "className" argument will be passed directly to FindClass, which
 * takes strings with slashes (e.g. "java/lang/Object").
 *
 * If an exception is currently pending, we log a warning message and
 * clear it.
 *
 * Returns 0 on success, nonzero if something failed (e.g. the exception
 * class couldn't be found, so *an* exception will still be pending).
 *
 * Currently aborts the VM if it can't throw the exception.
 */
int jniThrowException(C_JNIEnv* env, const char* className, const char* msg);

/*
 * Throw a java.lang.NullPointerException, with an optional message.
 */
int jniThrowNullPointerException(C_JNIEnv* env, const char* msg);

/*
 * Throw a java.lang.RuntimeException, with an optional message.
 */
int jniThrowRuntimeException(C_JNIEnv* env, const char* msg);

/*
 * Throw a java.io.IOException, generating the message from errno.
 */
int jniThrowIOException(C_JNIEnv* env, int errnum);

/*
 * Return a pointer to a locale-dependent error string explaining errno
 * value 'errnum'. The returned pointer may or may not be equal to 'buf'.
 * This function is thread-safe (unlike strerror) and portable (unlike
 * strerror_r).
 */
const char* jniStrError(int errnum, char* buf, size_t buflen);

/*
 * Returns a new java.io.FileDescriptor for the given int fd.
 */
jobject jniCreateFileDescriptor(C_JNIEnv* env, int fd);

/*
 * Returns the int fd from a java.io.FileDescriptor.
 */
int jniGetFDFromFileDescriptor(C_JNIEnv* env, jobject fileDescriptor);

/*
 * Sets the int fd in a java.io.FileDescriptor.
 */
void jniSetFileDescriptorOfFD(C_JNIEnv* env, jobject fileDescriptor, int value);

/*
 * Returns the reference from a java.lang.ref.Reference.
 */
jobject jniGetReferent(C_JNIEnv* env, jobject ref);

#ifdef __cplusplus
}
#endif


/*
 * For C++ code, we provide inlines that map to the C functions.  g++ always
 * inlines these, even on non-optimized builds.
 */
#if defined(__cplusplus)
inline int jniRegisterNativeMethods(JNIEnv* env, const char* className, const JNINativeMethod* gMethods, int numMethods) {
    return jniRegisterNativeMethods(&env->functions, className, gMethods, numMethods);
}

inline int jniThrowException(JNIEnv* env, const char* className, const char* msg) {
    return jniThrowException(&env->functions, className, msg);
}

extern "C" int jniThrowExceptionFmt(C_JNIEnv* env, const char* className, const char* fmt, va_list args);

/*
 * Equivalent to jniThrowException but with a printf-like format string and
 * variable-length argument list. This is only available in C++.
 */
inline int jniThrowExceptionFmt(JNIEnv* env, const char* className, const char* fmt, ...) {
    va_list args;
    va_start(args, fmt);
    return jniThrowExceptionFmt(&env->functions, className, fmt, args);
    va_end(args);
}

inline int jniThrowNullPointerException(JNIEnv* env, const char* msg) {
    return jniThrowNullPointerException(&env->functions, msg);
}

inline int jniThrowRuntimeException(JNIEnv* env, const char* msg) {
    return jniThrowRuntimeException(&env->functions, msg);
}

inline int jniThrowIOException(JNIEnv* env, int errnum) {
    return jniThrowIOException(&env->functions, errnum);
}

inline jobject jniCreateFileDescriptor(JNIEnv* env, int fd) {
    return jniCreateFileDescriptor(&env->functions, fd);
}

inline int jniGetFDFromFileDescriptor(JNIEnv* env, jobject fileDescriptor) {
    return jniGetFDFromFileDescriptor(&env->functions, fileDescriptor);
}

inline void jniSetFileDescriptorOfFD(JNIEnv* env, jobject fileDescriptor, int value) {
    jniSetFileDescriptorOfFD(&env->functions, fileDescriptor, value);
}

inline jobject jniGetReferent(JNIEnv* env, jobject ref) {
    return jniGetReferent(&env->functions, ref);
}

#endif

#define FIND_CLASS(var, className) \
        var = env->FindClass(className); \
        LOG_FATAL_IF(! var, "Unable to find class " className);

#define GET_METHOD_ID(var, clazz, methodName, fieldDescriptor) \
        var = env->GetMethodID(clazz, methodName, fieldDescriptor); \
        LOG_FATAL_IF(! var, "Unable to find method" methodName);

#define GET_FIELD_ID(var, clazz, fieldName, fieldDescriptor) \
        var = env->GetFieldID(clazz, fieldName, fieldDescriptor); \
        LOG_FATAL_IF(! var, "Unable to find field " fieldName);

#endif  /* NATIVEHELPER_JNIHELP_H_ */
