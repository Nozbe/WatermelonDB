package com.nozbe.watermelonTest

import com.facebook.react.ReactActivity
import com.nozbe.watermelondb.jsi.WatermelonJSI

class MainActivity : ReactActivity() {
    override fun getMainComponentName(): String = "watermelonTest"

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        WatermelonJSI.onTrimMemory(level)
    }
}
