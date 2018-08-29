package com.nozbe.watermelonTest

import com.nozbe.watermelondb.helpers.BridgeTestReporter
import org.junit.Test
import android.support.test.rule.ActivityTestRule
import android.util.Log
import org.junit.Assert
import org.junit.Rule

class BridgeTest {

    @get:Rule
    var activityRule: ActivityTestRule<MainActivity> = ActivityTestRule(MainActivity::class.java)

    @Test
    fun testBridge() {
        synchronized(BridgeTestReporter.testFinishedNotification) {
            BridgeTestReporter.testFinishedNotification.wait(60000)
        }
        try {
            val result = BridgeTestReporter.result
            when (result) {
                is BridgeTestReporter.Result.Success -> {
                    result.result.filter { it.isNotEmpty() }.forEach { Log.d("BridgeTest", it) }
                }
                is BridgeTestReporter.Result.Failure -> {
                    val failureString = result.errors.filter {
                        it.isNotEmpty()
                    }.joinToString(separator = "\n")
                    Assert.fail(failureString)

                }
            }
        } catch (e: UninitializedPropertyAccessException) {
            Assert.fail("Report could not have been obtained.")
        }
    }
}
