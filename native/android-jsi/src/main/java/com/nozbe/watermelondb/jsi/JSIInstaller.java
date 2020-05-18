package com.nozbe.watermelondb.jsi;

public class JSIInstaller {
    public native void installBinding(long javaScriptContextHolder);

    static {
        System.loadLibrary("watermelondb-jsi");
    }
}
