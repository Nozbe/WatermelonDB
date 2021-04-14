package com.nozbe.watermelondb.jsi;

import com.facebook.react.bridge.JSIModulePackage;
import com.facebook.react.bridge.JSIModuleSpec;
import com.facebook.react.bridge.JavaScriptContextHolder;
import com.facebook.react.bridge.ReactApplicationContext;

import java.util.Arrays;
import java.util.List;

public class WatermelonDBJSIPackage implements JSIModulePackage {
  @Override
  public List<JSIModuleSpec> getJSIModules(ReactApplicationContext reactApplicationContext, JavaScriptContextHolder jsContextHolder) {
    synchronized(jsContextHolder) {
      JSIInstaller.install(reactApplicationContext.getApplicationContext(), jsContextHolder.get());
    }
    return Arrays.<JSIModuleSpec>asList();
  }
}
