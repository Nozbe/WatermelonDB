package com.nozbe.watermelonTest

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.nozbe.watermelondb.jsi.WatermelonJSI

class MainActivity : ReactActivity() {
    override fun getMainComponentName(): String = "watermelonTest"

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        WatermelonJSI.onTrimMemory(level)
    }

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
