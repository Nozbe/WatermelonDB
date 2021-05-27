#pragma once

#include <jni.h>

namespace watermelondb {
namespace platform {

void configureJNI(JNIEnv *env);
void provideJson(jstring json);

} // namespace platform
} // namespace watermelondb
