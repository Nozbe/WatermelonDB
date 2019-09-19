package com.example.hellojni;

public class HelloJni {
    public native String stringFromJNI();
    public native String stringFromJNICpp();
    public native void installBinding(long runtimePointer);

    static {
        System.loadLibrary("hello-jni");
    }
}
