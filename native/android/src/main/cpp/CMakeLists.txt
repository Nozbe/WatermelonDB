cmake_minimum_required(VERSION 3.7.0)

add_library(
        # library name
        watermelondb
        # mark as shared library
        SHARED
        # source files:
        WatermelonHostObject.cpp
)

target_link_libraries(
        watermelondb
        android
        log
)