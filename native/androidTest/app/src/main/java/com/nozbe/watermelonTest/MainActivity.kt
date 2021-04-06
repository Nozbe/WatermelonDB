package com.nozbe.watermelonTest

import com.facebook.react.ReactActivity
import com.facebook.react.bridge.ReactContext
import com.nozbe.watermelondb.jsi.WatermelonJSI
import java.util.logging.Logger

class MainActivity : ReactActivity() {
    override fun getMainComponentName(): String? = "watermelonTest"

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        WatermelonJSI.onTrimMemory(level)
    }
}
