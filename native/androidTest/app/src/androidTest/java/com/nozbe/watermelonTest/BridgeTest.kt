package com.nozbe.watermelonTest

import org.junit.Test
import androidx.test.rule.ActivityTestRule
import android.util.Log
import org.junit.Assert
import org.junit.Rule

class BridgeTest {

    @get:Rule
    val activityRule: ActivityTestRule<MainActivity> = ActivityTestRule(MainActivity::class.java)

    @Test
    fun testBridge() {
        synchronized(BridgeTestReporter.testFinishedNotification) {
            // the timeout shouldn't be this huge, but currently something's wrong with the tests
            BridgeTestReporter.testFinishedNotification.wait(500000)
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
