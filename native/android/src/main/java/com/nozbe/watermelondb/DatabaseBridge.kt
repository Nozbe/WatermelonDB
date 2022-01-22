package com.nozbe.watermelondb

import android.database.SQLException
import android.os.Trace
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import java.util.logging.Logger
import kotlin.collections.ArrayList

class DatabaseBridge(private val reactContext: ReactApplicationContext) :
        ReactContextBaseJavaModule(reactContext) {
    companion object {
        const val NAME = "DatabaseBridge"
    }

    private val connections: MutableMap<ConnectionTag, Connection> = mutableMapOf()

    override fun getName(): String = NAME

    sealed class Connection {
        class Connected(val driver: DatabaseDriver) : Connection()
        class Waiting(val queueInWaiting: ArrayList<(() -> Unit)>) : Connection()

        val queue: ArrayList<(() -> Unit)>
            get() = when (this) {
                is Connected -> arrayListOf()
                is Waiting -> this.queueInWaiting
            }
    }

    @ReactMethod
    fun initialize(
        tag: ConnectionTag,
        databaseName: String,
        schemaVersion: Int,
        promise: Promise
    ) {
        assert(connections[tag] == null) { "A driver with tag $tag already set up" }
        val promiseMap = Arguments.createMap()

        try {
            connections[tag] = Connection.Connected(
                    driver = DatabaseDriver(
                            context = reactContext,
                            dbName = databaseName,
                            schemaVersion = schemaVersion
                    )
            )
            promiseMap.putString("code", "ok")
            promise.resolve(promiseMap)
        } catch (e: DatabaseDriver.SchemaNeededError) {
            connections[tag] = Connection.Waiting(queueInWaiting = arrayListOf())
            promiseMap.putString("code", "schema_needed")
            promise.resolve(promiseMap)
        } catch (e: DatabaseDriver.MigrationNeededError) {
            connections[tag] = Connection.Waiting(queueInWaiting = arrayListOf())
            promiseMap.putString("code", "migrations_needed")
            promiseMap.putInt("databaseVersion", e.databaseVersion)
            promise.resolve(promiseMap)
        } catch (e: Exception) {
            promise.reject(e)
        }
    }

    @ReactMethod
    fun setUpWithSchema(
        tag: ConnectionTag,
        databaseName: String,
        schema: SQL,
        schemaVersion: SchemaVersion,
        promise: Promise
    ) = connectDriver(
            connectionTag = tag,
            driver = DatabaseDriver(
                    context = reactContext,
                    dbName = databaseName,
                    schema = Schema(
                            version = schemaVersion,
                            sql = schema
                    )
            ),
            promise = promise
    )

    @ReactMethod
    fun setUpWithMigrations(
        tag: ConnectionTag,
        databaseName: String,
        migrations: SQL,
        fromVersion: SchemaVersion,
        toVersion: SchemaVersion,
        promise: Promise
    ) {
        try {
            connectDriver(
                    connectionTag = tag,
                    driver = DatabaseDriver(
                            context = reactContext,
                            dbName = databaseName,
                            migrations = MigrationSet(
                                    from = fromVersion,
                                    to = toVersion,
                                    sql = migrations
                            )
                    ),
                    promise = promise
            )
        } catch (e: Exception) {
            disconnectDriver(tag)
            promise.reject(e)
        }
    }

    @ReactMethod
    fun find(tag: ConnectionTag, table: TableName, id: RecordID, promise: Promise) =
            withDriver(tag, promise) { it.find(table, id) }

    @ReactMethod
    fun query(tag: ConnectionTag, table: TableName, query: SQL, args: ReadableArray, promise: Promise) =
            withDriver(tag, promise) { it.cachedQuery(table, query, args.toArrayList().toArray()) }

    @ReactMethod
    fun queryIds(tag: ConnectionTag, query: SQL, args: ReadableArray, promise: Promise) =
            withDriver(tag, promise) { it.queryIds(query, args.toArrayList().toArray()) }

    @ReactMethod
    fun unsafeQueryRaw(tag: ConnectionTag, query: SQL, args: ReadableArray, promise: Promise) =
            withDriver(tag, promise) { it.unsafeQueryRaw(query, args.toArrayList().toArray()) }

    @ReactMethod
    fun count(tag: ConnectionTag, query: SQL, args: ReadableArray, promise: Promise) =
            withDriver(tag, promise) { it.count(query, args.toArrayList().toArray()) }

    @ReactMethod
    fun batch(tag: ConnectionTag, operations: ReadableArray, promise: Promise) =
            withDriver(tag, promise) { it.batch(operations) }

    @ReactMethod
    fun unsafeResetDatabase(
        tag: ConnectionTag,
        schema: SQL,
        schemaVersion: SchemaVersion,
        promise: Promise
    ) = withDriver(tag, promise) { it.unsafeResetDatabase(Schema(schemaVersion, schema)) }

    @ReactMethod
    fun getLocal(tag: ConnectionTag, key: String, promise: Promise) =
            withDriver(tag, promise) { it.getLocal(key) }

    @Throws(Exception::class)
    private fun withDriver(
        tag: ConnectionTag,
        promise: Promise,
        function: (DatabaseDriver) -> Any?
    ) {
        val functionName = function.javaClass.enclosingMethod?.name
        try {
            Trace.beginSection("DatabaseBridge.$functionName")
            when (val connection =
                    connections[tag] ?: promise.reject(
                            Exception("No driver with tag $tag available"))) {
                is Connection.Connected -> {
                    val result = function(connection.driver)
                    promise.resolve(
                        if (result === Unit) {
                        true
                    } else {
                        result
                        }
                    )
                }
                is Connection.Waiting -> {
                    // try again when driver is ready
                    connection.queue.add { withDriver(tag, promise, function) }
                    connections[tag] = Connection.Waiting(connection.queue)
                }
            }
        } catch (e: SQLException) {
            promise.reject(functionName, e)
        } finally {
            Trace.endSection()
        }
    }

    private fun connectDriver(
        connectionTag: ConnectionTag,
        driver: DatabaseDriver,
        promise: Promise
    ) {
        val queue = connections[connectionTag]?.queue ?: arrayListOf()
        connections[connectionTag] = Connection.Connected(driver)

        for (operation in queue) {
            operation()
        }
        promise.resolve(true)
    }

    private fun disconnectDriver(connectionTag: ConnectionTag) {
        val queue = connections[connectionTag]?.queue ?: arrayListOf()
        connections.remove(connectionTag)

        for (operation in queue) {
            operation()
        }
    }

    @ReactMethod
    fun provideSyncJson(id: Int, json: String, promise: Promise) {
        // Note: WatermelonJSI is optional on Android, but we don't want users to have to set up
        // yet another NativeModule, so we're using Reflection to access it from here
        val clazz = Class.forName("com.nozbe.watermelondb.jsi.WatermelonJSI")
        val method = clazz.getDeclaredMethod("provideSyncJson", Int::class.java, ByteArray::class.java)
        method.invoke(null, id, json.toByteArray())
        promise.resolve(true)
    }

    override fun onCatalystInstanceDestroy() {
        // NOTE: See Database::install() for explanation
        super.onCatalystInstanceDestroy()
        reactContext.catalystInstance.reactQueueConfiguration.jsQueueThread.runOnQueue {
            try {
                val clazz = Class.forName("com.nozbe.watermelondb.jsi.WatermelonJSI")
                val method = clazz.getDeclaredMethod("onCatalystInstanceDestroy")
                method.invoke(null)
            } catch (e: Exception) {
                if (BuildConfig.DEBUG) {
                    Logger.getLogger("DB_Bridge").info("Could not find JSI onCatalystInstanceDestroy")
                }
            }
        }
    }
}
