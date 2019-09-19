package com.nozbe.watermelondb.jsi;

public class WatermelonJSIInstaller {
    public native void installBinding(long runtimePointer);

    static {
        System.loadLibrary("watermelondb-jsi");
    }
}
