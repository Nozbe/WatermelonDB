package com.nozbe.watermelonTest

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import java.util.logging.Logger

class BridgeTestReporter(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    sealed class Result {
        class Success(val result: List<String>) : Result()
        class Failure(val errors: List<String>) : Result()
    }

    override fun getName() = "BridgeTestReporter"

    companion object {
        lateinit var result: Result
        val testFinishedNotification = Object()
    }

    @Suppress("UNCHECKED_CAST")
    @ReactMethod
    fun testsFinished(report: ReadableMap) {
        Logger.getLogger(name).info(report.toString())
        val tempResult = report.toHashMap()["results"] as ArrayList<HashMap<String, Any>>
        result = if (report.getInt("errorCount") > 0) {
            val messages = tempResult.map {
                if (!(it["passed"] as Boolean)) {
                    it["message"] as String? ?: ""
                } else {
                    ""
                }
            }
            Result.Failure(messages)
        } else {
            val messages = tempResult.map {
                if (it["passed"] as Boolean) {
                    it["message"] as String? ?: ""
                } else {
                    ""
                }
            }
            Result.Success(messages)
        }
        synchronized(testFinishedNotification) {
            testFinishedNotification.notify()
        }
    }
}
