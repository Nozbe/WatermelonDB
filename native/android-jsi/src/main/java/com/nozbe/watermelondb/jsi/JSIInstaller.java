package com.nozbe.watermelondb.jsi;

import android.content.Context;
class JSIInstaller {
    static void install(Context context, long javaScriptContextHolder) {
        JSIInstaller.context = context;
        new JSIInstaller().installBinding(javaScriptContextHolder);

        // call methods we're going to need from JNI - if we don't, Proguard/R8 will strip it from
        // release binaries. We could use @Keep or configure Proguard to keep it but that would be
        // error prone for lib users
        _resolveDatabasePath("");
    }

    // Helper method called from C++
    static String _resolveDatabasePath(String dbName) {
        // On some systems there is some kind of lock on `/databases` folder ¯\_(ツ)_/¯
        return context.getDatabasePath(dbName + ".db").getPath().replace("/databases", "");
    }

    private native void installBinding(long javaScriptContextHolder);

    static native void provideSyncJson(int id, byte[] json);

    private static Context context;

    static {
        System.loadLibrary("watermelondb-jsi");
    }
}
