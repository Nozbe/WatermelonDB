#pragma once

#include <jni.h>

namespace watermelondb {
namespace platform {

void configureJNI(JNIEnv *env);
void provideJson(int id, jbyteArray array);
void destroy();

} // namespace platform
} // namespace watermelondb
