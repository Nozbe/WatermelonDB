cmake_minimum_required(VERSION 3.4.1)

include_directories(
        ../../../../../../node_modules/react-native/React
        ../../../../../../node_modules/react-native/React/Base
        ../../../../../../node_modules/react-native/ReactCommon
#        ../../../../../node_modules/react-native/third-party/folly-2018.10.22.00
        ##        ../../../../../node_modules/react-native/third-party/double-conversion-1.1.6
        ##        ../../../../../node_modules/react-native/third-party/boost_1_63_0
        ##        ../../../../../node_modules/react-native/third-party/glog-0.3.5/src
)

add_library(hello-jni SHARED
            # source files
            hello-jni.c
            HelloJniCpp.cpp)

# Include libraries needed for hello-jni lib
target_link_libraries(hello-jni
                      android
                      log)
