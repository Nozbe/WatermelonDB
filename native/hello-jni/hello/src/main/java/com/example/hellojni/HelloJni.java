package com.example.hellojni;

public class HelloJni {
    public native void installBinding(long runtimePointer);

    static {
        System.loadLibrary("hello-jni");
    }
}
