package com.app

import android.app.Application
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.shell.MainReactPackage
import com.nozbe.watermelondb.WatermelonDBPackage
import im.shimo.react.prompt.RNPromptPackage
import com.swmansion.gesturehandler.react.RNGestureHandlerPackage
import com.swmansion.rnscreens.RNScreensPackage
import java.util.Arrays
import java.util.Date

class MainApplication : Application(), ReactApplication {

    companion object {
        private lateinit var singleton: MainApplication
        val initTime = Date()
    }

    private val reactNativeHost = object : ReactNativeHost(this) {
        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override fun getPackages(): List<ReactPackage> =
                Arrays.asList<ReactPackage>(
                        MainReactPackage(),
                        NativeModulesPackage(),
                        RNPromptPackage(),
                        WatermelonDBPackage(),
                        RNGestureHandlerPackage(),
                        RNScreensPackage()
                )

        override fun getJSMainModuleName(): String = "index"
    }

    override fun getReactNativeHost(): ReactNativeHost = reactNativeHost

    override fun onCreate() {
        super.onCreate()
        singleton = this
    }
}
