#include "WatermelonHostObject.h"
#include <jni.h>

extern "C"
JNIEXPORT jstring JNICALL
Java_com_nozbe_watermelondb_WatermelonHostObject_stringFromJNI(JNIEnv *env, jobject thiz) {
    return (*env)->NewStringUTF(env, "Hello from JNI!");
}