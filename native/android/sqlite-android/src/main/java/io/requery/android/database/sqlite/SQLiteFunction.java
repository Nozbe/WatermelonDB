package io.requery.android.database.sqlite;

/**
 * @author dhleong
 */
public class SQLiteFunction {
    public final String name;
    public final int numArgs;
    public final SQLiteDatabase.Function callback;

    // accessed from native code
    final int flags;

    // NOTE: from a single database connection, all calls to
    // functions are serialized by SQLITE-internal mutexes,
    // so we save on GC churn by reusing a single, shared instance
    private final MyArgs args = new MyArgs();
    private final MyResult result = new MyResult();

    /**
     * Create custom function.
     *
     * @param name The name of the sqlite3 function.
     * @param numArgs The number of arguments for the function, or -1 to
     * support any number of arguments.
     * @param callback The callback to invoke when the function is executed.
     * @param flags Extra SQLITE flags to pass when creating the function
     * in native code.
     */
    public SQLiteFunction(String name, int numArgs,
            SQLiteDatabase.Function callback) {
        this(name, numArgs, callback, 0);
    }

    /**
     * Create custom function.
     *
     * @param name The name of the sqlite3 function.
     * @param numArgs The number of arguments for the function, or -1 to
     * support any number of arguments.
     * @param callback The callback to invoke when the function is executed.
     * @param flags Extra SQLITE flags to pass when creating the function
     * in native code.
     */
    public SQLiteFunction(String name, int numArgs,
            SQLiteDatabase.Function callback,
            int flags) {
        if (name == null) {
            throw new IllegalArgumentException("name must not be null.");
        }

        this.name = name;
        this.numArgs = numArgs;
        this.callback = callback;
        this.flags = flags;
    }

    // Called from native.
    @SuppressWarnings("unused")
    private void dispatchCallback(long contextPtr, long argsPtr, int argsCount) {
        result.contextPtr = contextPtr;
        args.argsPtr = argsPtr;
        args.argsCount = argsCount;

        try {
            callback.callback(args, result);

            if (!result.isSet) {
                result.setNull();
            }

        } finally {
            result.contextPtr = 0;
            result.isSet = false;
            args.argsPtr = 0;
            args.argsCount = 0;
        }
    }

    static native byte[] nativeGetArgBlob(long argsPtr, int arg);
    static native String nativeGetArgString(long argsPtr, int arg);
    static native double nativeGetArgDouble(long argsPtr, int arg);
    static native int nativeGetArgInt(long argsPtr, int arg);
    static native long nativeGetArgLong(long argsPtr, int arg);

    static native void nativeSetResultBlob(long contextPtr, byte[] result);
    static native void nativeSetResultString(long contextPtr, String result);
    static native void nativeSetResultDouble(long contextPtr, double result);
    static native void nativeSetResultInt(long contextPtr, int result);
    static native void nativeSetResultLong(long contextPtr, long result);
    static native void nativeSetResultError(long contextPtr, String error);
    static native void nativeSetResultNull(long contextPtr);

    private static class MyArgs implements SQLiteDatabase.Function.Args {
        long argsPtr;
        int argsCount;

        @Override
        public byte[] getBlob(int arg) {
            return nativeGetArgBlob(argsPtr, checkArg(arg));
        }

        @Override
        public String getString(int arg) {
            return nativeGetArgString(argsPtr, checkArg(arg));
        }

        @Override
        public double getDouble(int arg) {
            return nativeGetArgDouble(argsPtr, checkArg(arg));
        }

        @Override
        public int getInt(int arg) {
            return nativeGetArgInt(argsPtr, checkArg(arg));
        }

        @Override
        public long getLong(int arg) {
            return nativeGetArgLong(argsPtr, checkArg(arg));
        }

        private int checkArg(int arg) {
            if (arg < 0 || arg >= argsCount) {
                throw new IllegalArgumentException(
                    "Requested arg " + arg + " but had " + argsCount
                );
            }

            return arg;
        }
    }

    private static class MyResult implements SQLiteDatabase.Function.Result {
        long contextPtr;
        boolean isSet;

        @Override
        public void set(byte[] value) {
            checkSet();
            nativeSetResultBlob(contextPtr, value);
        }

        @Override
        public void set(double value) {
            checkSet();
            nativeSetResultDouble(contextPtr, value);
        }

        @Override
        public void set(int value) {
            checkSet();
            nativeSetResultInt(contextPtr, value);
        }

        @Override
        public void set(long value) {
            checkSet();
            nativeSetResultLong(contextPtr, value);
        }

        @Override
        public void set(String value) {
            checkSet();
            nativeSetResultString(contextPtr, value);
        }

        @Override
        public void setError(String error) {
            checkSet();
            nativeSetResultError(contextPtr, error);
        }

        @Override
        public void setNull() {
            checkSet();
            nativeSetResultNull(contextPtr);
        }

        private void checkSet() {
            if (isSet) throw new IllegalStateException("Result is already set");
            isSet = true;
        }
    }
}
