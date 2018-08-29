package com.nozbe.watermelonTest

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class NativeModulesPackage : ReactPackage {

    override fun createViewManagers(reactContext: ReactApplicationContext)
            : List<ViewManager<*, *>> = emptyList()

    override fun createNativeModules(reactContext: ReactApplicationContext)
            : List<NativeModule> = emptyList()
}