
#include <jni.h>
#include <jsi/jsi.h>

#include "JSIInstaller.h"

using namespace facebook;

extern "C" JNIEXPORT void JNICALL Java_com_nozbe_watermelondb_jsi_JSIInstaller_installBinding(JNIEnv *env, jobject thiz, jlong runtimePtr) {
    jsi::Runtime *runtime = (jsi::Runtime *)runtimePtr;
    assert(runtime != nullptr);
    auto &rt = *runtime;

    jsi::String proofString = jsi::String::createFromAscii(rt, "Hello! This is a string from C++!!! 10");

    rt.global().setProperty(rt, "wmelonJsiProof", std::move(proofString));
}
