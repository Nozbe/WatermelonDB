package com.native63;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;

import java.util.HashMap;
import java.util.Map;

public class PerformancePlugin extends ReactContextBaseJavaModule {
    PerformancePlugin(ReactApplicationContext context) {
        super(context);
    }

    @NonNull
    @Override
    public String getName() {
        return "PerformancePlugin";
    }

    @NonNull
    @Override
    public Map<String, Object> getConstants() {
        HashMap<String, Object> hm = new HashMap<>();
        hm.put("appInitTimestamp", MainApplication.initTime.getTime());
        return hm;
    }
}
