# ./android/app/src/main/jni/Android.mk
# Set up paths
LOCAL_PATH := $(call my-dir)
include $(CLEAR_VARS)

# Debug mode
NDK_DEBUG=1

# Specify C++ flags
LOCAL_CPPFLAGS := -std=c++14
LOCAL_CPPFLAGS += -fexceptions
LOCAL_CPPFLAGS += -frtti
LOCAL_CPPFLAGS += -Wall
LOCAL_CPPFLAGS += -Wextra
# LOCAL_CPPFLAGS += -I$(LOCAL_PATH)/../../../../../djinni/jni
# LOCAL_CPPFLAGS += -I$(LOCAL_PATH)/../../../../../djinni/cpp
# LOCAL_CPPFLAGS += -I$(LOCAL_PATH)/../../../../../node_modules/djinni/support-lib/jni
# LOCAL_CPPFLAGS += -I$(LOCAL_PATH)/../../../../../node_modules/djinni/support-lib
LOCAL_CPPFLAGS += -I$(LOCAL_PATH)

# Specify sourc files
# LOCAL_SRC_FILES += $(LOCAL_PATH)/../../../../../djinni/jni/NativeHelloWorld.cpp
LOCAL_SRC_FILES += $(wildcard $(LOCAL_PATH)/*.cpp)
# LOCAL_SRC_FILES += $(wildcard $(LOCAL_PATH)/../../../../../node_modules/djinni/support-lib/jni/*.cpp)
# LOCAL_SRC_FILES += $(wildcard $(LOCAL_PATH)/../../../../../node_modules/djinni/support-lib/*.cpp)

# Specify module name for System.loadLibrary() call
LOCAL_MODULE := watermelondb

# Telling make to build the library
include $(BUILD_SHARED_LIBRARY)
