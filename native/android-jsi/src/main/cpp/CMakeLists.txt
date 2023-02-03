PROJECT(watermelondb-jsi C CXX)
cmake_minimum_required(VERSION 3.4.1)

# inspired by https://github.com/ericlewis/react-native-hostobject-demo/blob/6f16c01db80f928ccd294c8cc5d4668b0f8c15ec/android/app/CMakeLists.txt
# execute_process (COMMAND ln "-s" "src" "../../../../../node_modules/react-native/third-party/double-conversion-1.1.6/double-conversion")

set(WMELON_JSI_BUMP 1)

# -------------------------------------------------
# Figure out where node_modules is
# (surely there's a better way to do this)
# This has to work with standard RN project, Nozbe's unusual folder structure and internal Watermelon tester

get_filename_component(_nativeTesterPath "../../../../../node_modules/@nozbe/sqlite/" REALPATH)
get_filename_component(_nozbePath "../../../../../../../../../native/node_modules/react-native/ReactCommon/jsi/jsi/" REALPATH)

if(EXISTS "${_nativeTesterPath}")
        # these paths work for WatermelonDB native tester
        set(NODE_MODULES_PATH_WM ../../../../../node_modules/)
        set(NODE_MODULES_PATH_RN ../../../../../node_modules/)
elseif(EXISTS "${_nozbePath}")
        # these paths work for Nozbe
        set(NODE_MODULES_PATH_WM ../../../../../../../)
        set(NODE_MODULES_PATH_RN ../../../../../../../../../native/node_modules/)
else()
        # these paths should work for a standard RN project
        set(NODE_MODULES_PATH_WM ../../../../../../../)
        set(NODE_MODULES_PATH_RN ../../../../../../../)
endif()

# -------------------------------------------------
# Header search paths
# FIXME: <simdjson/simdjson.h> should work…

set(SQLITE_VERSION sqlite-amalgamation-3400100)

include_directories(
        ../../../../shared
        ${NODE_MODULES_PATH_WM}/@nozbe/sqlite/${SQLITE_VERSION}/
        ${NODE_MODULES_PATH_WM}/@nozbe/simdjson/src/
        ${NODE_MODULES_PATH_RN}/react-native/React
        ${NODE_MODULES_PATH_RN}/react-native/React/Base
        ${NODE_MODULES_PATH_RN}/react-native/ReactCommon
        ${NODE_MODULES_PATH_RN}/react-native/ReactCommon/jsi
        # these seem necessary only if we import <jsi/JSIDynamic.h>
        #  ../../../../../node_modules/react-native/third-party/folly-2018.10.22.00
        #  ../../../../../node_modules/react-native/third-party/double-conversion-1.1.6
        #  ../../../../../node_modules/react-native/third-party/boost_1_63_0
        #  ../../../../../node_modules/react-native/third-party/glog-0.3.5/src
)

# -------------------------------------------------
# Build configuration

#add_definitions(
#        -DFOLLY_USE_LIBCPP=1
#        -DFOLLY_NO_CONFIG=1
#        -DFOLLY_HAVE_MEMRCHR=1
#)

# simdjson is slow without optimization
set(CMAKE_CXX_FLAGS_DEBUG "-Os") # comment out for JSI debugging
set(CMAKE_CXX_FLAGS_RELEASE "-Os")

# TODO: Configure sqlite with compile-time options
# https://www.sqlite.org/compile.html

# -------------------------------------------------
# Source files

file(GLOB ANDROID_JSI_SRC_FILES ./*.cpp)
file(GLOB SHARED_SRC_FILES ../../../../shared/*.cpp)

add_library(watermelondb-jsi SHARED
        # vendor files
        ${NODE_MODULES_PATH_WM}/@nozbe/sqlite/${SQLITE_VERSION}/sqlite3.c
        ${NODE_MODULES_PATH_WM}/@nozbe/simdjson/src/simdjson.cpp
        # our sources
        ${ANDROID_JSI_SRC_FILES}
        ${SHARED_SRC_FILES}
        # this seems necessary to use almost any JSI API - otherwise we get linker errors
        # seems wrong to compile a file that's already getting compiled as part of the app, but ¯\_(ツ)_/¯
        ${NODE_MODULES_PATH_RN}/react-native/ReactCommon/jsi/jsi/jsi.cpp)

target_link_libraries(watermelondb-jsi
                      # link with these libraries:
                      android
                      log)
