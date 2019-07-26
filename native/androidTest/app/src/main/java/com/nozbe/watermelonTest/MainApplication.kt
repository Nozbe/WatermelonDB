package com.nozbe.watermelonTest

import android.app.Application
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.shell.MainReactPackage
import com.nozbe.watermelondb.WatermelonDBPackage

class MainApplication : Application(), ReactApplication {

    private val reactNativeHost = object : ReactNativeHost(this) {
        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override fun getPackages(): List<ReactPackage> =
                listOf(MainReactPackage(), NativeModulesPackage(), WatermelonDBPackage())

        override fun getJSMainModuleName(): String = "src/index.integrationTests.native"
    }

    override fun getReactNativeHost(): ReactNativeHost = reactNativeHost
}
