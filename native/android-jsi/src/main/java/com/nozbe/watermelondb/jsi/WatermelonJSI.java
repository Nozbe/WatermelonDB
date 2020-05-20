package com.nozbe.watermelondb.jsi;

import android.app.Application;

// Public interface to JSI-based Watermelon
public class WatermelonJSI {
    public static void install(Application context, long javaScriptContextHolder) {
        JSIInstaller.install(context, javaScriptContextHolder);
    }

    public static void onTrimMemory(int level) {
      // TODO: Unimplemented
    }
}
