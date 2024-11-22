package com.nozbe.watermelondb.jsi;

import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.JavaScriptContextHolder;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.module.annotations.ReactModule;

@ReactModule(name = WatermelonDBJSIModule.NAME)
public class WatermelonDBJSIModule extends ReactContextBaseJavaModule {
  ReactApplicationContext reactContext;
  public static final String NAME = "WMDatabaseJSIBridge";

   public WatermelonDBJSIModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

  @NonNull
  @Override
  public String getName() {
    return NAME;
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  public boolean install() {
    try {
      JavaScriptContextHolder jsContext = getReactApplicationContext().getJavaScriptContextHolder();
      JSIInstaller.install(getReactApplicationContext(), jsContext.get());
      Log.i(NAME, "Successfully installed Watermelon DB JSI Bindings!");
      return true;
    } catch (Exception exception) {
      Log.e(NAME, "Failed to install Watermelon DB JSI Bindings!", exception);
      return false;
    }
  }
}