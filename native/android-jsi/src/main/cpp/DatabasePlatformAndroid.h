#pragma once

#include <jni.h>

namespace watermelondb {
namespace platform {

void configureJNI(JNIEnv *env, jobject helpersObject);

} // namespace platform
} // namespace watermelondb
