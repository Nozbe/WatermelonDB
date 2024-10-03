
#include <jni.h>
#include <jsi/jsi.h>
#include "JSIAndroidBridgeWrapper.h"

using namespace facebook;

extern "C" JNIEXPORT
void JNICALL Java_com_nozbe_watermelondb_jsi_JSIAndroidBridgeInstaller_installBinding(
        JNIEnv *env,
        jobject thiz,
        jlong runtimePtr,
        jobject bridge) {
    jsi::Runtime *runtime = (jsi::Runtime *)runtimePtr;

    assert(runtime != nullptr);
    assert(bridge != nullptr);

    jobject dbBridge = env->NewGlobalRef(bridge);

    watermelondb::configureJNI(env);
    watermelondb::JSIAndroidBridge::install(runtime, dbBridge);
}
