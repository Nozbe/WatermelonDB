package com.nozbe.watermelonTest

import android.app.Application
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.JSIModulePackage
import com.facebook.react.shell.MainReactPackage
import com.nozbe.watermelondb.WatermelonDBPackage
import com.nozbe.watermelondb.jsi.WatermelonDBJSIPackage
import java.util.Arrays

class MainApplication : Application(), ReactApplication {

    private val reactNativeHost = object : ReactNativeHost(this) {
        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override fun getPackages(): List<ReactPackage> =
                Arrays.asList<ReactPackage>(
                        MainReactPackage(),
                        NativeModulesPackage(),
                        WatermelonDBPackage()
                )

        override fun getJSIModulePackage(): JSIModulePackage? {
            return WatermelonDBJSIPackage()
        }

        override fun getJSMainModuleName(): String = "src/index.integrationTests.native"
    }

    override fun getReactNativeHost(): ReactNativeHost = reactNativeHost
}
