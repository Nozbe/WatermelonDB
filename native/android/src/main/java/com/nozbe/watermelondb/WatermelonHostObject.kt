package com.nozbe.watermelondb

class WatermelonHostObject {
    external fun stringFromJNI(): String

    companion object {
        init {
            //System.loadLibrary("watermelondb")
        }
    }
}