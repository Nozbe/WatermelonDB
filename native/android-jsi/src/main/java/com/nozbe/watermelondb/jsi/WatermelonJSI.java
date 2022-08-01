package com.nozbe.watermelondb.jsi;

import android.app.Application;

// Public interface to JSI-based Watermelon
public class WatermelonJSI {
    public static void onTrimMemory(int level) {
      // TODO: Unimplemented
    }

    public static void provideSyncJson(int id, byte[] json) {
        JSIInstaller.provideSyncJson(id, json);
    }

    public static void onCatalystInstanceDestroy() {
        JSIInstaller.destroy();
    }
}
