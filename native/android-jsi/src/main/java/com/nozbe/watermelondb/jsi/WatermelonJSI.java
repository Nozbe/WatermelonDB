package com.nozbe.watermelondb.jsi;

import android.app.Application;
import com.nozbe.watermelondb.jsi.JSIInstaller;

// Public interface to JSI-based Watermelon
public class WatermelonJSI {
    public static void onTrimMemory(int level) {
      // TODO: Unimplemented
    }

    public static void provideJson(String json) {
      JSIInstaller.provideJsonStatic(json);
    }
}
