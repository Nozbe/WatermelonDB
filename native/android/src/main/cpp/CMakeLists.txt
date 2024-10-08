
# For more information about using CMake with Android Studio, read the
# documentation: https://d.android.com/studio/projects/add-native-code.html.
# For more examples on how to use CMake, see https://github.com/android/ndk-samples.

project(watermelondb-jsi-android-bridge)

# Sets the minimum CMake version required for this project.
cmake_minimum_required(VERSION 3.22.1)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(
        ../../../../shared
        ../../../../../../../react-native/React
        ../../../../../../../react-native/React/Base
        ../../../../../../../react-native/ReactCommon
        ../../../../../../../react-native/ReactCommon/jsi
)

# Creates and names a library, sets it as either STATIC
# or SHARED, and provides the relative paths to its source code.
# You can define multiple libraries, and CMake builds them for you.
# Gradle automatically packages shared libraries with your APK.
#
# In this top level CMakeLists.txt, ${CMAKE_PROJECT_NAME} is used to define
# the target library name; in the sub-module's CMakeLists.txt, ${PROJECT_NAME}
# is preferred for the same purpose.
#
# In order to load a library into your app from Java/Kotlin, you must call
# System.loadLibrary() and pass the name of the library defined here;
# for GameActivity/NativeActivity derived applications, the same library name must be
# used in the AndroidManifest.xml file.
add_library(watermelondb-jsi-android-bridge SHARED
        ../../../../shared/Sqlite.cpp
        ../../../../shared/DatabaseUtils.cpp
        ../../../../../../../react-native/ReactCommon/jsi/jsi/jsi.cpp
        # List C/C++ source files with relative paths to this CMakeLists.txt.
        JSIAndroidBridgeWrapper.cpp
        JSIAndroidBridgeInstaller.cpp)

# Specifies libraries CMake should link to your target library. You
# can link libraries from various origins, such as libraries defined in this
# build script, prebuilt third-party libraries, or Android system libraries.

find_package(sqlite-android REQUIRED CONFIG)

target_link_libraries(watermelondb-jsi-android-bridge
        sqlite-android::sqlite3x
        # List libraries link to the target library
        android
        log)
