package com.nozbe.watermelondb.jsi;

import android.app.Application;

public class JSIInstaller {
    public static void install(Application context, long javaScriptContextHolder) {
        JSIInstaller.context = context;
        new JSIInstaller().installBinding(javaScriptContextHolder);
    }

    // Helper method called from C++
    public static String _resolveDatabasePath(String dbName) {
        // On some systems there is some kind of lock on `/databases` folder ¯\_(ツ)_/¯
        return context.getDatabasePath(dbName + ".db").getPath().replace("/databases", "");
    }

    public native void installBinding(long javaScriptContextHolder);

    private static Application context;

    static {
        System.loadLibrary("watermelondb-jsi");
    }
}
