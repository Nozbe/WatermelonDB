package com.nozbe.watermelondb

import android.database.SQLException
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray
import com.nozbe.watermelondb.DatabaseDriver.Operation

class DatabaseBridge(private val reactContext: ReactApplicationContext) :
        ReactContextBaseJavaModule(reactContext) {

    private val connections: MutableMap<ConnectionTag, Connection> = mutableMapOf()

    override fun getName(): String = "DatabaseBridge"

    sealed class Connection {
        class Connected(val driver: DatabaseDriver) : Connection()
        class Waiting(var queueW: Array<(() -> Unit)>) : Connection()

        var queue: Array<(() -> Unit)> = arrayOf()
            get() = when (this) {
                is Connection.Connected -> emptyArray()
                is Connection.Waiting -> this.queueW
            }
    }

    @ReactMethod
    fun initialize(tag: ConnectionTag,
                   databaseName: String,
                   schemaVersion: Int,
                   promise: Promise) {
//        assert(connections[tag] == null, "A driver with tag \(tag) already set up")

        try {
            val driver = DatabaseDriver(reactContext, dbName = databaseName, schemaVersion = schemaVersion)
            connections[tag] = Connection.Connected(driver)
            promise.resolve(mapOf("code" to "ok"))
        } catch (e: DatabaseDriver.SchemaNeededError) {
            connections[tag] = Connection.Waiting(arrayOf())
            promise.resolve(mapOf("code" to "schema_needed"))
        } catch (e: DatabaseDriver.MigrationNeededError) {
            connections[tag] = Connection.Waiting(arrayOf())
            promise.resolve(
                    mapOf("code" to "migrations_needed", "databaseVersion" to e.databaseVersion)
            )
        } catch (e: Exception) {
            //                assertionFailure("Unknown error thrown in DatabaseDriver.init")
            promise.reject(e)
        }
    }

    @ReactMethod
    fun setUpWithSchema(tag: ConnectionTag,
                        databaseName: String,
                        schema: SQL,
                        schemaVersion: Int,
                        promise: Promise) {
        val driver = DatabaseDriver(
                context = reactContext,
                dbName = databaseName,
                schema = Schema(schemaVersion, schema)
        )
        connectDriver(tag, driver)
        promise.resolve(true)
    }

    @ReactMethod
    fun setUpWithMigrations(tag: ConnectionTag,
                            databaseName: String,
                            migrations: SQL,
                            fromVersion: Int,
                            toVersion: Int,
                            promise: Promise) {
        val driver = DatabaseDriver(
                context = reactContext,
                dbName = databaseName,
                migrations = MigrationSet(from = fromVersion, to = toVersion, sql = migrations)
        )
        connectDriver(tag, driver)
        promise.resolve(true)
    }

    @ReactMethod
    fun find(tag: ConnectionTag, table: TableName, id: RecordID, promise: Promise) =
            withDriver(tag, promise) { it.find(table, id) }

    @ReactMethod
    fun query(tag: ConnectionTag, query: SQL, promise: Promise) =
            withDriver(tag, promise) { it.cachedQuery(query) }

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
    ) =
            withDriver(tag, promise) {
                it.destroyDeletedRecords(table, records.toArrayList())
            }

    @ReactMethod
    fun unsafeResetDatabase(tag: ConnectionTag, schema: Schema, promise: Promise) =
            withDriver(tag, promise) { it.unsafeResetDatabase(schema) }

    @ReactMethod
    fun unsafeClearCachedRecords(tag: ConnectionTag, promise: Promise) =
            withDriver(tag, promise) { it.unsafeClearCachedRecords() }

    @ReactMethod
    fun getLocal(tag: ConnectionTag, key: String, promise: Promise) =
            withDriver(tag, promise) { it.getLocal(key) }

    @ReactMethod
    fun setLocal(tag: ConnectionTag, key: String, value: String, promise: Promise) =
            withDriver(tag, promise) { it.setLocal(key, value) }

    @ReactMethod
    fun removeLocal(tag: ConnectionTag, key: String, promise: Promise) =
            withDriver(tag, promise) { it.removeLocal(key) }

    private fun withDriver(tag: ConnectionTag, promise: Promise, function: (DatabaseDriver) -> Any?) {
        try {
            val connection = connections[tag]
            when (connection) {
                is Connection.Connected -> {
                    val result = function(connection.driver)
                    promise.resolve(if (result === Unit) true else result)
                }
                is Connection.Waiting -> {
                    // try again when driver is ready
                    connection.queue.plus {
                        this.withDriver(tag, promise, function)
                    }
                    connections[tag] = Connection.Waiting(connection.queue)
                }
                else -> {
                }
            }
        } catch (e: SQLException) {
            promise.reject(e)
        }
    }

    private fun ReadableArray.toOperationsArray(): ArrayList<Operation> {
        val preparedOperations = arrayListOf<Operation>()
        for (i in 0 until this.size()) {
            try {
                val operation = this.getArray(i)
                val type = operation.getString(0)
                try {
                    when (type) {
                        "execute" -> {
                            val query = operation.getString(1) as SQL
                            val args = operation.getArray(2).toArrayList() as QueryArgs
                            preparedOperations.add(Operation.Execute(query, args))
                        }
                        "create" -> {
                            val id = operation.getString(1) as RecordID
                            val query = operation.getString(2) as SQL
                            val args = operation.getArray(3).toArrayList() as QueryArgs
                            preparedOperations.add(Operation.Create(id, query, args))
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
                } catch (e: ClassCastException) {
                    throw (Throwable("Bad $type arguments", e))
                }
            } catch (e: Exception) {
                throw (Throwable("Operations should be in Array"))
            }
        }
        return preparedOperations
    }

    private fun connectDriver(connectionTag: ConnectionTag, driver: DatabaseDriver) {
        val queue = connections[connectionTag]?.queue ?: emptyArray()
        connections[connectionTag] = Connection.Connected(driver)

        for (operation in queue) {
            operation()
        }
    }

}
