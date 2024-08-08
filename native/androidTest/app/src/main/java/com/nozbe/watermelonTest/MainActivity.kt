package com.nozbe.watermelonTest

import com.facebook.react.ReactActivity
import com.nozbe.watermelondb.jsi.WatermelonJSI

class MainActivity : ReactActivity() {
    override fun getMainComponentName(): String = "watermelonTest"

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        WatermelonJSI.onTrimMemory(level)
    }

    // TODO: add createReactActivityDelegate? https://raw.githubusercontent.com/react-native-community/rn-diff-purge/release/0.72.15/RnDiffApp/android/app/src/main/java/com/rndiffapp/MainActivity.java
}
