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

    private val connections: MutableMap<ConnectionTag, DatabaseDriver> = mutableMapOf()

    override fun getName(): String = "DatabaseBridge"

    @ReactMethod
    fun setUp(tag: ConnectionTag, databaseName: String,
              schema: SQL, schemaVersion: Int, promise: Promise) {
        val driver = DatabaseDriver(
                reactContext,
                DatabaseDriver.Configuration(
                        databaseName,
                        schema,
                        schemaVersion
                )
        )
        connections[tag] = driver
        promise.resolve(true)
    }

    @ReactMethod
    fun find(tag: ConnectionTag, table: TableName, id: RecordID, promise: Promise) =
            connections[tag]?.doWithPromise(promise) { it.find(table, id) }

    @ReactMethod
    fun query(tag: ConnectionTag, query: SQL, promise: Promise) =
            connections[tag]?.doWithPromise(promise) { it.cachedQuery(query) }

    @ReactMethod
    fun count(tag: ConnectionTag, query: SQL, promise: Promise) =
            connections[tag]?.doWithPromise(promise) { it.count(query) }

    @ReactMethod
    fun batch(tag: ConnectionTag, operations: ReadableArray, promise: Promise) =
            connections[tag]?.doWithPromise(promise) { it.batch(operations.toOperationsArray()) }

    @ReactMethod
    fun getDeletedRecords(tag: ConnectionTag, table: TableName, promise: Promise) =
            connections[tag]?.doWithPromise(promise) { it.getDeletedRecords(table) }

    @ReactMethod
    fun destroyDeletedRecords(tag: ConnectionTag, table: TableName,
                              records: ReadableArray, promise: Promise) =
            connections[tag]?.doWithPromise(promise) {
                it.destroyDeletedRecords(table, records.toArrayList())
            }

    @ReactMethod
    fun unsafeResetDatabase(tag: ConnectionTag, promise: Promise) =
            connections[tag]?.doWithPromise(promise) { it.unsafeResetDatabase() }

    @ReactMethod
    fun unsafeClearCachedRecords(tag: ConnectionTag, promise: Promise) =
            connections[tag]?.doWithPromise(promise) { it.unsafeClearCachedRecords() }

    @ReactMethod
    fun getLocal(tag: ConnectionTag, key: String, promise: Promise) =
            connections[tag]?.doWithPromise(promise) { it.getLocal(key) }

    @ReactMethod
    fun setLocal(tag: ConnectionTag, key: String, value: String, promise: Promise) =
            connections[tag]?.doWithPromise(promise) { it.setLocal(key, value) }

    @ReactMethod
    fun removeLocal(tag: ConnectionTag, key: String, promise: Promise) =
            connections[tag]?.doWithPromise(promise) { it.removeLocal(key) }

    private fun DatabaseDriver.doWithPromise(promise: Promise, function: (DatabaseDriver) -> Any?) =
            try {
                val result = function(this)
                promise.resolve(if (result === Unit) true else result)
            } catch (e: SQLException) {
                promise.reject(e)
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
}
