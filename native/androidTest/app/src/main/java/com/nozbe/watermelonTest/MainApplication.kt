package com.nozbe.watermelonTest

import android.app.Application
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.JSIModule
import com.facebook.react.bridge.JSIModulePackage
import com.facebook.react.bridge.JSIModuleSpec
import com.facebook.react.shell.MainReactPackage
import com.nozbe.watermelondb.WatermelonDBPackage
import com.nozbe.watermelondb.jsi.WatermelonDBJSIPackage
import java.util.Arrays
import com.facebook.soloader.SoLoader

class MainApplication : Application(), ReactApplication {

    private val reactNativeHost = object : ReactNativeHost(this) {
        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override fun getPackages(): List<ReactPackage> =
                listOf(MainReactPackage(), NativeModulesPackage(), WatermelonDBPackage())

        override fun getJSIModulePackage(): JSIModulePackage? {
            return JSIModulePackage { reactApplicationContext, jsContext ->
                mutableListOf<JSIModuleSpec<JSIModule>>().apply {
                    addAll(
                            WatermelonDBJSIPackage().getJSIModules(
                                    reactApplicationContext,
                                    jsContext
                            )
                    )
                }
            }
        }

        override fun getJSMainModuleName(): String = "src/index.integrationTests.native"
    }

    override fun onCreate() {
        super.onCreate()
        SoLoader.init(this, false)
    }

    override fun getReactNativeHost(): ReactNativeHost = reactNativeHost
}
