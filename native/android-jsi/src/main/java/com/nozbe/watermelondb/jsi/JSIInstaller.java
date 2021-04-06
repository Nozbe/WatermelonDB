package com.nozbe.watermelondb.jsi;

import android.content.Context;

class JSIInstaller {
    static void install(Context context, long javaScriptContextHolder) {
        JSIInstaller.context = context;
        new JSIInstaller().installBinding(javaScriptContextHolder);
    }

    // Helper method called from C++
    static String _resolveDatabasePath(String dbName) {
        // On some systems there is some kind of lock on `/databases` folder ¯\_(ツ)_/¯
        return context.getDatabasePath(dbName + ".db").getPath().replace("/databases", "");
    }

    private native void installBinding(long javaScriptContextHolder);

    private static Context context;

    static {
        System.loadLibrary("watermelondb-jsi");
    }
}
