PROJECT(watermelondb-jsi C CXX)
cmake_minimum_required(VERSION 3.4.1)

# inspired by https://github.com/ericlewis/react-native-hostobject-demo/blob/6f16c01db80f928ccd294c8cc5d4668b0f8c15ec/android/app/CMakeLists.txt
# execute_process (COMMAND ln "-s" "src" "../../../../../node_modules/react-native/third-party/double-conversion-1.1.6/double-conversion")

# TODO: Fix duplication

include_directories(
        ../../../../shared
# these paths work for WatermelonDB native tester
        ../../../../../node_modules/@nozbe/sqlite/sqlite-amalgamation-3400100/
        ../../../../../node_modules/@nozbe/simdjson/src/
        ../../../../../node_modules/react-native/React
        ../../../../../node_modules/react-native/React/Base
        ../../../../../node_modules/react-native/ReactCommon
        ../../../../../node_modules/react-native/ReactCommon/jsi
# these seem necessary only if we import <jsi/JSIDynamic.h>
#        ../../../../../node_modules/react-native/third-party/folly-2018.10.22.00
#        ../../../../../node_modules/react-native/third-party/double-conversion-1.1.6
#        ../../../../../node_modules/react-native/third-party/boost_1_63_0
#        ../../../../../node_modules/react-native/third-party/glog-0.3.5/src

# these paths should work for a standard RN project
        ../../../../../../sqlite/sqlite-amalgamation-3400100/
        ../../../../../../simdjson/src/
        ../../../../../../../react-native/React
        ../../../../../../../react-native/React/Base
        ../../../../../../../react-native/ReactCommon
        ../../../../../../../react-native/ReactCommon/jsi

# these paths work for Nozbe Teams
        ../../../../../../../../../native/node_modules/react-native/React
        ../../../../../../../../../native/node_modules/react-native/React/Base
        ../../../../../../../../../native/node_modules/react-native/ReactCommon
        ../../../../../../../../../native/node_modules/react-native/ReactCommon/jsi
)

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

get_filename_component(_nativeTesterPath "../../../../../node_modules/@nozbe/sqlite/" REALPATH)
get_filename_component(_nozbeTeamsPath "../../../../../../../../../native/node_modules/react-native/ReactCommon/jsi/jsi/" REALPATH)

if(EXISTS "${_nativeTesterPath}")
        # these paths work for WatermelonDB native tester
        add_library(watermelondb-jsi SHARED
                # vendor files
                ../../../../../node_modules/@nozbe/sqlite/sqlite-amalgamation-3400100/sqlite3.c
                ../../../../../node_modules/@nozbe/simdjson/src/simdjson.cpp
                # source files
                JSIInstaller.cpp
                DatabasePlatformAndroid.cpp
                JSLockPerfHack.cpp
                # shared sources
                ../../../../shared/Sqlite.cpp
                ../../../../shared/Database.cpp
                ../../../../shared/DatabaseBridge.cpp
                # this seems necessary to use almost any JSI API - otherwise we get linker errors
                # seems wrong to compile a file that's already getting compiled as part of the app, but ¯\_(ツ)_/¯
                ../../../../../node_modules/react-native/ReactCommon/jsi/jsi/jsi.cpp)
elseif(EXISTS "${_nozbeTeamsPath}")
        # these paths work for Nozbe Teams
        add_library(watermelondb-jsi SHARED
                ../../../../../../sqlite/sqlite-amalgamation-3400100/sqlite3.c
                ../../../../../../simdjson/src/simdjson.cpp
                JSIInstaller.cpp
                DatabasePlatformAndroid.cpp
                JSLockPerfHack.cpp
                # shared sources
                ../../../../shared/Sqlite.cpp
                ../../../../shared/Database.cpp
                ../../../../shared/DatabaseBridge.cpp
                ../../../../../../../../../native/node_modules/react-native/ReactCommon/jsi/jsi/jsi.cpp)
else()
        # these paths should work for a standard RN project
        add_library(watermelondb-jsi SHARED
                ../../../../../../sqlite/sqlite-amalgamation-3400100/sqlite3.c
                ../../../../../../simdjson/src/simdjson.cpp
                JSIInstaller.cpp
                DatabasePlatformAndroid.cpp
                JSLockPerfHack.cpp
                ../../../../shared/Sqlite.cpp
                ../../../../shared/Database.cpp
                ../../../../shared/DatabaseBridge.cpp
                ../../../../../../../react-native/ReactCommon/jsi/jsi/jsi.cpp)
endif()

target_link_libraries(watermelondb-jsi
                      # link with these libraries:
                      android
                      log)
