package com.nozbe.watermelondb

import android.database.SQLException
import android.os.Debug
import android.os.Trace
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.Arguments
import com.nozbe.watermelondb.DatabaseDriver.Operation

class DatabaseBridge(private val reactContext: ReactApplicationContext) :
        ReactContextBaseJavaModule(reactContext) {

    private val connections: MutableMap<ConnectionTag, Connection> = mutableMapOf()

    override fun getName(): String = "DatabaseBridge"

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
    fun query(tag: ConnectionTag, table: TableName, query: SQL, promise: Promise) =
            withDriver(tag, promise) { it.cachedQuery(table, query) }

    @ReactMethod
    fun count(tag: ConnectionTag, query: SQL, promise: Promise) =
            withDriver(tag, promise) { it.count(query) }

    @ReactMethod
    fun batch(tag: ConnectionTag, operations: ReadableArray, promise: Promise) =
            withDriver(tag, promise) { it.batch(operations.toOperationsArray()) }

    @ReactMethod
    fun getDeletedRecords(tag: ConnectionTag, table: TableName, promise: Promise) =
            withDriver(tag, promise) { it.getDeletedRecords(table) }

    @ReactMethod
    fun destroyDeletedRecords(
        tag: ConnectionTag,
        table: TableName,
        records: ReadableArray,
        promise: Promise
    ) = withDriver(tag, promise) { it.destroyDeletedRecords(table, records.toArrayList()) }

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

    @ReactMethod
    fun setLocal(tag: ConnectionTag, key: String, value: String, promise: Promise) =
            withDriver(tag, promise) { it.setLocal(key, value) }

    @ReactMethod
    fun removeLocal(tag: ConnectionTag, key: String, promise: Promise) =
            withDriver(tag, promise) { it.removeLocal(key) }

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
                    promise.resolve(if (result === Unit) {
                        true
                    } else {
                        result
                    })
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

    private fun ReadableArray.toOperationsArray(): ArrayList<Operation> {
        Trace.beginSection("ReadableArray.toOperationsArray()")
        val preparedOperations = arrayListOf<Operation>()
        try {
            for (i in 0 until this.size()) {
                val operation = this.getArray(i)
                val type = operation?.getString(0)
                when (type) {
                    "execute" -> {
                        val table = operation.getString(1) as TableName
                        val query = operation.getString(2) as SQL
                        val args = operation.getArray(3)?.toArrayList() as QueryArgs
                        preparedOperations.add(Operation.Execute(table, query, args))
                    }
                    "create" -> {
                        val table = operation.getString(1) as TableName
                        val id = operation.getString(2) as RecordID
                        val query = operation.getString(3) as SQL
                        val args = operation.getArray(4)?.toArrayList() as QueryArgs
                        preparedOperations.add(Operation.Create(table, id, query, args))
                    }
                    "markAsDeleted" -> {
                        val table = operation.getString(1) as TableName
                        val id = operation.getString(2) as RecordID
                        preparedOperations.add(Operation.MarkAsDeleted(table, id))
                    }
                    "destroyPermanently" -> {
                        val table = operation.getString(1) as TableName
                        val id = operation.getString(2) as RecordID
                        preparedOperations.add(Operation.DestroyPermanently(table, id))
                    }
                    // "setLocal" -> {
                    //     val key = operation.getString(1)
                    //     val value = operation.getString(2)
                    //     preparedOperations.add(Operation.SetLocal(key, value))
                    // }
                    // "removeLocal" -> {
                    //     val key = operation.getString(1)
                    //     preparedOperations.add(Operation.RemoveLoacl(key))
                    // }
                    else -> throw (Throwable("Bad operation name in batch"))
                }
            }
        } catch (e: Exception) {
            throw (Throwable("Bad batch parameters"))
        } finally {
            Trace.endSection()
        }
        return preparedOperations
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
}
