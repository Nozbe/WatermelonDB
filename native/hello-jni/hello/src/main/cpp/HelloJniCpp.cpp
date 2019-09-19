//
// Created by Radosław Pietruszewski on 2019-09-19.
//

#include <jni.h>

#include "HelloJniCpp.h"

extern "C" JNIEXPORT jstring JNICALL
Java_com_example_hellojni_HelloJni_stringFromJNICpp(JNIEnv* env, jobject thiz) {
    return env->NewStringUTF("Hello from JeeEnnAyee C++");
}