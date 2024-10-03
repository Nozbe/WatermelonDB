package com.nozbe.watermelondb.jsi;

import com.nozbe.watermelondb.DatabaseBridge;

public class JSIAndroidBridgeInstaller {
    public static void install(long javaScriptContextHolder, DatabaseBridge bridge) {
        new JSIAndroidBridgeInstaller().installBinding(javaScriptContextHolder, bridge);
    }

    private native void installBinding(long javaScriptContextHolder, DatabaseBridge bridge);

    static {
        System.loadLibrary("watermelondb-jsi-android-bridge");
    }
}


