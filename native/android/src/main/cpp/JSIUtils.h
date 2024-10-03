#pragma once

#include <jni.h>
#include <jsi/jsi.h>

using namespace facebook;

jsi::Array convertWritableArrayToJSIArray(jsi::Runtime &runtime, JNIEnv *env, jobject writableArray);

jsi::Value convertReadableMapToJSIValue(jsi::Runtime &runtime, JNIEnv *env, jobject readableMap);

jsi::Object convertHashMapToJSIObject(jsi::Runtime& runtime, JNIEnv* env, jobject hashMap);

jobject convertJSIArrayToReadableArray(jsi::Runtime &runtime, JNIEnv *env, const jsi::Array &jsiArray);

jsi::String convertJObjectToJSIString(jsi::Runtime& runtime, JNIEnv* env, jobject obj);

jsi::Value convertJObjectToJSIValue(jsi::Runtime& runtime, JNIEnv* env, jobject obj);

jsi::Array convertArrayListToJSIArray(jsi::Runtime& runtime, JNIEnv* env, jobject arrayList);