//
// Created by Radosław Pietruszewski on 2019-09-19.
//

#include <jsi/jsi.h>
#include <jni.h>

#include "HelloJniCpp.h"

using namespace facebook;

extern "C" JNIEXPORT jstring JNICALL
Java_com_example_hellojni_HelloJni_stringFromJNICpp(JNIEnv* env, jobject thiz) {
    return env->NewStringUTF("Hello from JeeEnnAyee C++");
}

extern "C" JNIEXPORT void JNICALL
Java_com_example_hellojni_HelloJni_installBinding(JNIEnv* env, jobject thiz, jlong runtimePtr) {
    jsi::Runtime &runtime = *(jsi::Runtime*)runtimePtr;

    jsi::String proofString = jsi::String::createFromAscii(runtime, "Hello");

    auto global = runtime.global();
//    global.setProperty(runtime, "wmelonJsiProof", std::move(proofString));

//    runtime.global().setProperty(runtime, "wmelonJsiProof", std::move(proofString));
}
