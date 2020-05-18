package com.nozbe.watermelondb.jsi;

public class WatermelonJSIInstaller {
    public native void installBinding(long javaScriptContextHolder);

    static {
        System.loadLibrary("watermelondb-jsi");
    }
}
