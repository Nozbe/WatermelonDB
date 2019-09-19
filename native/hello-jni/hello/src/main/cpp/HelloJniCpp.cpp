
#include <jsi/jsi.h>
#include <jni.h>

#include "HelloJniCpp.h"

using namespace facebook;

extern "C" JNIEXPORT void JNICALL
Java_com_example_hellojni_HelloJni_installBinding(JNIEnv* env, jobject thiz, jlong runtimePtr) {
    jsi::Runtime &runtime = *(jsi::Runtime *) runtimePtr;

    jsi::String proofString = jsi::String::createFromAscii(runtime, "Hello! This is a string from C++ (3)");

    runtime.global().setProperty(runtime, "wmelonJsiProof", std::move(proofString));
}
