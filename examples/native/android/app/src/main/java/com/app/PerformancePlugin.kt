package com.app

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.app.MainApplication

class PerformancePlugin(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "PerformancePlugin"

    override fun getConstants(): Map<String, Any> = hashMapOf("appInitTimestamp" to MainApplication.initTime.time)
}
