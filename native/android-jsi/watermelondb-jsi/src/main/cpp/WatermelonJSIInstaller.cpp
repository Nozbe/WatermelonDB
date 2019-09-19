
#include <jsi/jsi.h>
#include <jni.h>

#include "WatermelonJSIInstaller.h"

using namespace facebook;

extern "C" JNIEXPORT void JNICALL
Java_com_nozbe_watermelondb_jsi_WatermelonJSIInstaller_installBinding(JNIEnv *env, jobject thiz, jlong runtimePtr)
{
    jsi::Runtime &runtime = *(jsi::Runtime *)runtimePtr;

    jsi::String proofString = jsi::String::createFromAscii(runtime, "Hello! This is a string from C++ (6)");

    runtime.global().setProperty(runtime, "wmelonJsiProof", std::move(proofString));
}
