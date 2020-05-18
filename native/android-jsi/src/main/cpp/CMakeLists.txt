cmake_minimum_required(VERSION 3.4.1)

# inspired by https://github.com/ericlewis/react-native-hostobject-demo/blob/6f16c01db80f928ccd294c8cc5d4668b0f8c15ec/android/app/CMakeLists.txt
# execute_process (COMMAND ln "-s" "src" "../../../../../node_modules/react-native/third-party/double-conversion-1.1.6/double-conversion")

include_directories(
        ../../../../../node_modules/react-native/React
        ../../../../../node_modules/react-native/React/Base
        ../../../../../node_modules/react-native/ReactCommon
# these seem necessary only if we import <jsi/JSIDynamic.h>
#        ../../../../../node_modules/react-native/third-party/folly-2018.10.22.00
#        ../../../../../node_modules/react-native/third-party/double-conversion-1.1.6
#        ../../../../../node_modules/react-native/third-party/boost_1_63_0
#        ../../../../../node_modules/react-native/third-party/glog-0.3.5/src
)

#add_definitions(
#        -DFOLLY_USE_LIBCPP=1
#        -DFOLLY_NO_CONFIG=1
#        -DFOLLY_HAVE_MEMRCHR=1
#)

add_library(watermelondb-jsi SHARED
            # source files
            WatermelonJSIInstaller.cpp
            # this seems necessary to use almost any JSI API - otherwise we get linker errors
            # seems wrong to compile a file that's already getting compiled as part of the app, but ¯\_(ツ)_/¯
            ../../../../../node_modules/react-native/ReactCommon/jsi/jsi.cpp)

target_link_libraries(watermelondb-jsi
                      # link with these libraries:
                      android
                      log)
