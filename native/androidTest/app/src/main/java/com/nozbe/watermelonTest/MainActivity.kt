package com.nozbe.watermelonTest

import com.facebook.react.ReactActivity
import com.facebook.react.bridge.ReactContext
import com.facebook.react.ReactInstanceManager
import com.nozbe.watermelondb.jsi.WatermelonJSI

class MainActivity : ReactActivity(), ReactInstanceManager.ReactInstanceEventListener {
    override fun getMainComponentName(): String? = "watermelonTest"

    public override fun onResume() {
        super.onResume()
        reactInstanceManager.addReactInstanceEventListener(this)
    }

    public override fun onPause() {
        super.onPause()
        reactInstanceManager.removeReactInstanceEventListener(this)
    }

    override fun onReactContextInitialized(context: ReactContext) {
        // WatermelonJSI.install(this.application, context.javaScriptContextHolder.get())
    }

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        // WatermelonJSI.onTrimMemory(level)
    }
}
