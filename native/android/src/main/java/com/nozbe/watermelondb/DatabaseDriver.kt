package com.nozbe.watermelondb

import android.os.Trace
import android.content.Context
import android.database.Cursor
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableArray
import java.lang.Exception
import java.util.logging.Logger

class DatabaseDriver(context: Context, dbName: String) {
    sealed class Operation {
        class Execute(val table: TableName, val query: SQL, val args: QueryArgs) : Operation()
        class Create(val table: TableName, val id: RecordID, val query: SQL, val args: QueryArgs) :
                Operation()

        class MarkAsDeleted(val table: TableName, val id: RecordID) : Operation()
        class DestroyPermanently(val table: TableName, val id: RecordID) : Operation()
        // class SetLocal(val key: String, val value: String) : Operation()
        // class RemoveLocal(val key: String) : Operation()
    }

    class SchemaNeededError : Exception()
    data class MigrationNeededError(val databaseVersion: SchemaVersion) : Exception()

    constructor(context: Context, dbName: String, schemaVersion: SchemaVersion) :
            this(context, dbName) {
        when (val compatibility = isCompatible(schemaVersion)) {
            is SchemaCompatibility.NeedsSetup -> throw SchemaNeededError()
            is SchemaCompatibility.NeedsMigration ->
                throw MigrationNeededError(compatibility.fromVersion)
        }
    }

    constructor(context: Context, dbName: String, schema: Schema) : this(context, dbName) {
        unsafeResetDatabase(schema)
    }

    constructor(context: Context, dbName: String, migrations: MigrationSet) :
            this(context, dbName) {
        migrate(migrations)
    }

    private val database: Database = Database(dbName, context)

    private val log: Logger? = if (BuildConfig.DEBUG) Logger.getLogger("DB_Driver") else null

    private val cachedRecords: MutableMap<TableName, MutableList<RecordID>> = mutableMapOf()

    fun find(table: TableName, id: RecordID): Any? {
        if (isCached(table, id)) {
            return id
        }
        database.rawQuery("select * from `$table` where id == ? limit 1", arrayOf(id)).use {
            if (it.count <= 0) {
                return null
            }
            val resultMap = Arguments.createMap()
            markAsCached(table, id)
            it.moveToFirst()
            resultMap.mapCursor(it)
            return resultMap
        }
    }

    fun cachedQuery(table: TableName, query: SQL, args: QueryArgs): WritableArray {
        // log?.info("Cached Query: $query")
        val resultArray = Arguments.createArray()
        database.rawQuery(query, args).use {
            if (it.count > 0 && it.columnNames.contains("id")) {
                while (it.moveToNext()) {
                    val id = it.getString(it.getColumnIndex("id"))
                    if (isCached(table, id)) {
                        resultArray.pushString(id)
                    } else {
                        markAsCached(table, id)
                        resultArray.pushMapFromCursor(it)
                    }
                }
            }
        }
        return resultArray
    }

    fun queryIds(query: SQL, args: QueryArgs): WritableArray {
        val resultArray = Arguments.createArray()
        database.rawQuery(query, args).use {
            if (it.count > 0 && it.columnNames.contains("id")) {
                while (it.moveToNext()) {
                    resultArray.pushString(it.getString(it.getColumnIndex("id")))
                }
            }
        }
        return resultArray
    }

    private fun WritableArray.pushMapFromCursor(cursor: Cursor) {
        val cursorMap = Arguments.createMap()
        cursorMap.mapCursor(cursor)
        this.pushMap(cursorMap)
    }

    fun destroyDeletedRecords(table: TableName, records: QueryArgs) =
            database.delete(Queries.multipleDeleteFromTable(table, records), records)

    fun count(query: SQL, args: QueryArgs): Int = database.count(query, args)

    private fun execute(query: SQL, args: QueryArgs) {
        // log?.info("Executing: $query")
        database.execute(query, args)
    }

    fun getLocal(key: String): String? {
        // log?.info("Get Local: $key")
        return database.getFromLocalStorage(key)
    }

    private fun create(id: RecordID, query: SQL, args: QueryArgs) {
        // log?.info("Create id: $id query: $query")
        database.execute(query, args)
    }

    fun batch(operations: ReadableArray) {
        // log?.info("Batch of ${operations.size()}")
        val newIds = arrayListOf<Pair<TableName, RecordID>>()
        val removedIds = arrayListOf<Pair<TableName, RecordID>>()

        Trace.beginSection("Batch")
        try {
            database.transaction {
                for (i in 0 until operations.size()) {
                    val operation = operations.getArray(i)
                    val type = operation?.getString(0)
                    when (type) {
                        "execute" -> {
                            val query = operation.getString(1) as SQL
                            val args = operation.getArray(2)!!.toArrayList().toArray()
                            execute(query, args)
                        }
                        "create" -> {
                            val table = operation.getString(1) as TableName
                            val id = operation.getString(2) as RecordID
                            val query = operation.getString(3) as SQL
                            val args = operation.getArray(4)!!.toArrayList().toArray()
                            create(id, query, args)
                            newIds.add(Pair(table, id))
                        }
                        "markAsDeleted" -> {
                            val table = operation.getString(1) as TableName
                            val id = operation.getString(2) as RecordID
                            database.execute(Queries.setStatusDeleted(table), arrayOf(id))
                            removedIds.add(Pair(table, id))
                        }
                        "destroyPermanently" -> {
                            val table = operation.getString(1) as TableName
                            val id = operation.getString(2) as RecordID
                            database.execute(Queries.destroyPermanently(table), arrayOf(id))
                            removedIds.add(Pair(table, id))
                        }
                        else -> throw (Throwable("unknown batch operation"))
                    }
                }
            }
        } finally {
            Trace.endSection()
        }

        Trace.beginSection("updateCaches")
        newIds.forEach { markAsCached(table = it.first, id = it.second) }
        removedIds.forEach { removeFromCache(table = it.first, id = it.second) }
        Trace.endSection()
    }

    fun unsafeResetDatabase(schema: Schema) {
        log?.info("Unsafe Reset Database")
        database.unsafeDestroyEverything()
        cachedRecords.clear()
        setUpSchema(schema)
    }

    fun close() = database.close()

    private fun markAsCached(table: TableName, id: RecordID) {
        // log?.info("Mark as cached $id")
        val cache = cachedRecords[table] ?: mutableListOf()
        cache.add(id)
        cachedRecords[table] = cache
    }

    private fun isCached(table: TableName, id: RecordID): Boolean =
            cachedRecords[table]?.contains(id) ?: false

    private fun removeFromCache(table: TableName, id: RecordID) = cachedRecords[table]?.remove(id)

    private fun setUpSchema(schema: Schema) {
        database.transaction {
            database.unsafeExecuteStatements(schema.sql + Queries.localStorageSchema)
            database.userVersion = schema.version
        }
    }

    private fun migrate(migrations: MigrationSet) {
        require(database.userVersion == migrations.from) {
            "Incompatible migration set applied. " +
                    "DB: ${database.userVersion}, migration: ${migrations.from}"
        }

        database.transaction {
            database.unsafeExecuteStatements(migrations.sql)
            database.userVersion = migrations.to
        }
    }

    sealed class SchemaCompatibility {
        object Compatible : SchemaCompatibility()
        object NeedsSetup : SchemaCompatibility()
        class NeedsMigration(val fromVersion: SchemaVersion) : SchemaCompatibility()
    }

    private fun isCompatible(schemaVersion: SchemaVersion): SchemaCompatibility =
            when (val databaseVersion = database.userVersion) {
                schemaVersion -> SchemaCompatibility.Compatible
                0 -> SchemaCompatibility.NeedsSetup
                in 1 until schemaVersion ->
                    SchemaCompatibility.NeedsMigration(fromVersion = databaseVersion)
                else -> {
                    log?.info("Database has newer version ($databaseVersion) than what the " +
                            "app supports ($schemaVersion). Will reset database.")
                    SchemaCompatibility.NeedsSetup
                }
            }
}
