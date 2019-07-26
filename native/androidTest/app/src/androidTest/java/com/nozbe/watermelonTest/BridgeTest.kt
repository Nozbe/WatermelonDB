package com.nozbe.watermelonTest

import org.junit.Test
import androidx.test.rule.ActivityTestRule
import android.util.Log
import org.junit.Assert
import org.junit.Rule

import com.cavynativereporter.RNCavyNativeReporterModule
import junit.framework.Assert.assertEquals

class BridgeTest {

    @get:Rule
    val activityRule: ActivityTestRule<MainActivity> = ActivityTestRule(MainActivity::class.java)

    @Test
    fun testBridge() {
        RNCavyNativeReporterModule.waitForReport(60)
        val errorCount = RNCavyNativeReporterModule.cavyReport.getDouble("errorCount")
        assertEquals(0.0, errorCount, 0.0)
    }
}
