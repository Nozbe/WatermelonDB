package com.nozbe.watermelondb;

import android.content.Context;
import android.os.Trace;
import androidx.annotation.NonNull;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.nozbe.watermelondb.utils.MigrationSet;
import com.nozbe.watermelondb.utils.Schema;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Logger;

public class DatabaseBridge extends ReactContextBaseJavaModule {
    ReactApplicationContext reactContext;

    public DatabaseBridge(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }


    public static final String NAME = "DatabaseBridge";

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    private final Map<Integer, Connection> connections = new HashMap<>();

    @ReactMethod
    public void initialize(final Integer tag, final String databaseName, final int schemaVersion, final boolean unsafeNativeReuse, final Promise promise) {
        if (connections.containsKey(tag)) {
            throw new IllegalStateException("A driver with tag " + tag + " already set up");
        }
        final WritableMap promiseMap = Arguments.createMap();
        try {
            connections.put(tag, new Connection.Connected(new DatabaseDriver((Context) reactContext, databaseName, schemaVersion, unsafeNativeReuse)));
            promiseMap.putString("code", "ok");
            promise.resolve(promiseMap);
        } catch (SchemaNeededError e) {
            connections.put(tag, new Connection.Waiting(new ArrayList<>()));
            promiseMap.putString("code", "schema_needed");
            promise.resolve(promiseMap);
        } catch (MigrationNeededError e) {
            connections.put(tag, new Connection.Waiting(new ArrayList<>()));
            promiseMap.putString("code", "migrations_needed");
            promiseMap.putInt("databaseVersion", e.databaseVersion);
            promise.resolve(promiseMap);
        } catch (Exception e) {
            promise.reject(e);
        }
    }

    @ReactMethod
    public void setUpWithSchema(final Integer tag, final String databaseName, final String schema, final int schemaVersion, final boolean unsafeNativeReuse, final Promise promise) {
        connectDriver(tag, new DatabaseDriver(reactContext, databaseName, new Schema(schemaVersion, schema), unsafeNativeReuse), promise);
    }

    @ReactMethod
    public void setUpWithMigrations(final Integer tag, final String databaseName, final String migrations, final int fromVersion, final int toVersion, final boolean unsafeNativeReuse, final Promise promise) {
        try {
            connectDriver(tag, new DatabaseDriver(reactContext, databaseName, new MigrationSet(fromVersion, toVersion, migrations), unsafeNativeReuse), promise);
        } catch (Exception e) {
            disconnectDriver(tag);
            promise.reject(e);
        }
    }

    @ReactMethod
    private void find(int tag, String table, String id, Promise promise) {
        withDriver(tag, promise, (driver) -> driver.find(table, id));
    }

    @ReactMethod
    public void query(int tag, String table, String query, ReadableArray args, Promise promise) {
        withDriver(tag, promise, (driver) -> driver.cachedQuery(table, query, args.toArrayList().toArray()));
    }

    @ReactMethod
    public void queryIds(int tag, String query, ReadableArray args, Promise promise) {
        withDriver(tag, promise, (driver) -> driver.queryIds(query, args.toArrayList().toArray()));
    }

    @ReactMethod
    public void unsafeQueryRaw(int tag, String query, ReadableArray args, Promise promise) {
        withDriver(tag, promise, (driver) -> driver.unsafeQueryRaw(query, args.toArrayList().toArray()));
    }

    @ReactMethod
    public void count(int tag, String query, ReadableArray args, Promise promise) {
        withDriver(tag, promise, (driver) -> driver.count(query, args.toArrayList().toArray()));
    }

    @ReactMethod
    public void batch(int tag, ReadableArray operations, Promise promise) {
        withDriver(tag, promise, (driver) -> {
            driver.batch(operations);
            return null;
        });
    }

    @ReactMethod
    public void unsafeResetDatabase(int tag, String schema, int schemaVersion, Promise promise) {
        withDriver(tag, promise, (driver) -> {
            driver.unsafeResetDatabase(new Schema(schemaVersion, schema));
            return null;
        });
    }

    @ReactMethod
    public void getLocal(int tag, String key, Promise promise) {
        withDriver(tag, promise, (driver) -> driver.getLocal(key));
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    public WritableArray unsafeGetLocalSynchronously(int tag, String key) {
        try {
            Connection connection = connections.get(tag);
            if (connection == null) {
                throw new Exception("No driver with tag " + tag + " available");
            }
            if (connection instanceof Connection.Connected) {
                String value = ((Connection.Connected) connection).driver.getLocal(key);
                WritableArray result = Arguments.createArray();
                result.pushString("result");
                result.pushString(value);
                return result;
            } else if (connection instanceof Connection.Waiting) {
                throw new Exception("Waiting connection unexpected for unsafeGetLocalSynchronously");
            }
        } catch (Exception e) {
            WritableArray result = Arguments.createArray();
            result.pushString("error");
            result.pushString(e.getMessage());
            return result;
        }
        return null;
    }

    private List<Runnable> getQueue(int connectionTag) {
        List<Runnable> queue;
        if (connections.containsKey(connectionTag)) {
            Connection connection = connections.get(connectionTag);
            if (connection != null) {
                queue = connection.getQueue();
            } else {
                queue = new ArrayList<>();
            }
        } else {
            queue = new ArrayList<>();
        }
        return queue;
    }

    interface ParamFunction {
        Object apply(DatabaseDriver arg);
    }

    private void withDriver(final int tag, final Promise promise, final ParamFunction function) {
        Method enclosingMethod = function.getClass().getEnclosingMethod();
        String functionName = enclosingMethod != null ? enclosingMethod.getName() : "unknown";
        try {
            Trace.beginSection("DatabaseBridge." + functionName);
            Connection connection = connections.get(tag);
            if (connection == null) {
                promise.reject(new Exception("No driver with tag " + tag + " available"));
            } else if (connection instanceof Connection.Connected) {
                Object result = function.apply(((Connection.Connected) connection).driver);
                promise.resolve(result == null || result == Void.TYPE ? true : result);
            } else if (connection instanceof Connection.Waiting) {
                // try again when driver is ready
                connection.getQueue().add(() -> withDriver(tag, promise, function));
                connections.put(tag, new Connection.Waiting(connection.getQueue()));
            }
        } catch (Exception e) {
            promise.reject(functionName, e);
        } finally {
            Trace.endSection();
        }
    }


    private void connectDriver(int connectionTag, DatabaseDriver driver, Promise promise) {
        List<Runnable> queue = getQueue(connectionTag);
        connections.put(connectionTag, new Connection.Connected(driver));

        for (Runnable operation : queue) {
            operation.run();
        }
        promise.resolve(true);
    }

    private void disconnectDriver(int connectionTag) {
        List<Runnable> queue = getQueue(connectionTag);

        connections.remove(connectionTag);

        for (Runnable operation : queue) {
            operation.run();
        }
    }

    @ReactMethod
    public void provideSyncJson(int id, String json, Promise promise) {
        // Note: WatermelonJSI is optional on Android, but we don't want users to have to set up
        // yet another NativeModule, so we're using Reflection to access it from here
        try {
            Class<?> clazz = Class.forName("com.nozbe.watermelondb.jsi.WatermelonJSI");
            Method method = clazz.getDeclaredMethod("provideSyncJson", int.class, byte[].class);
            method.invoke(null, id, json.getBytes());
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject(e);
        }
    }

    @Override
    public void invalidate() {
        // NOTE: See com.nozbe.watermelondb.Database::install() for explanation
        super.invalidate();
        reactContext.getCatalystInstance().getReactQueueConfiguration().getJSQueueThread().runOnQueue(() -> {
            try {
                Class<?> clazz = Class.forName("com.nozbe.watermelondb.jsi.WatermelonJSI");
                Method method = clazz.getDeclaredMethod("onCatalystInstanceDestroy");
                method.invoke(null);
            } catch (Exception e) {
                if (BuildConfig.DEBUG) {
                    Logger logger = Logger.getLogger("DB_Bridge");
                    logger.info("Could not find JSI onCatalystInstanceDestroy");
                }
            }
        });
    }

    @Deprecated
    @Override
    public void onCatalystInstanceDestroy() {
        // NOTE: See com.nozbe.watermelondb.Database::install() for explanation
        super.onCatalystInstanceDestroy();
        reactContext.getCatalystInstance().getReactQueueConfiguration().getJSQueueThread().runOnQueue(() -> {
            try {
                Class<?> clazz = Class.forName("com.nozbe.watermelondb.jsi.WatermelonJSI");
                Method method = clazz.getDeclaredMethod("onCatalystInstanceDestroy");
                method.invoke(null);
            } catch (Exception e) {
                if (BuildConfig.DEBUG) {
                    Logger logger = Logger.getLogger("DB_Bridge");
                    logger.info("Could not find JSI onCatalystInstanceDestroy");
                }
            }
        });
    }
}
