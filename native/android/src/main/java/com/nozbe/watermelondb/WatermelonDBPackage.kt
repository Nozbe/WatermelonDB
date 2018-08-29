package com.nozbe.watermelondb

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.JavaScriptModule
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.nozbe.watermelondb.helpers.BridgeTestReporter

class WatermelonDBPackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(DatabaseBridge(reactContext), BridgeTestReporter(reactContext))

    @Deprecated("Deprecated RN 0.47", ReplaceWith("createViewManagers()"))
    fun createJSModules(): List<Class<out JavaScriptModule>> = emptyList()

    override fun createViewManagers(reactContext: ReactApplicationContext)
            : List<ViewManager<*, *>> = emptyList()
}
