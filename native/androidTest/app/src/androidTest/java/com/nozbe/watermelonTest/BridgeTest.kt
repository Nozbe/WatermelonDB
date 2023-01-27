package com.nozbe.watermelonTest

import android.util.Log
import androidx.test.rule.ActivityTestRule
import org.junit.Assert
import org.junit.Rule
import org.junit.Test

class BridgeTest {

    @get:Rule
    val activityRule: ActivityTestRule<MainActivity> = ActivityTestRule(MainActivity::class.java)

    @Test
    fun testBridge() {
        synchronized(BridgeTestReporter.testFinishedNotification) {
            BridgeTestReporter.testFinishedNotification.wait(5 * 60 * 1000)
        }
        try {
            when (val result = BridgeTestReporter.result) {
                is BridgeTestReporter.Result.Success -> {
                    result.result.filter { it.isNotEmpty() }.forEach { Log.d("BridgeTest", it) }
                }
                is BridgeTestReporter.Result.Failure -> {
                    val failureString = result.errors.asSequence().filter {
                        it.isNotEmpty()
                    }.joinToString(separator = "\n")
                    Assert.fail(failureString)
                }
            }
        } catch (e: UninitializedPropertyAccessException) {
            Assert.fail("Bridge tests timed out and a report could not have been obtained. Either JS code could not be run at all or one of the asynchronous tests never returned")
        }
    }
}
