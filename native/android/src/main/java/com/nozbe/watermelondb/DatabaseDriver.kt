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

    fun count(query: SQL, args: QueryArgs): Int = database.count(query, args)

    fun getLocal(key: String): String? {
        // log?.info("Get Local: $key")
        return database.getFromLocalStorage(key)
    }

    fun batch(operations: ReadableArray) {
        val newIds = arrayListOf<Pair<TableName, RecordID>>()
        val removedIds = arrayListOf<Pair<TableName, RecordID>>()

        Trace.beginSection("Batch")
        try {
            database.transaction {
                for (i in 0 until operations.size()) {
                    val operation = operations.getArray(i)!!
                    val cacheBehavior = operation.getInt(0)
                    val table = if (cacheBehavior != 0) operation.getString(1)!! else ""
                    val sql = operation.getString(2) as SQL
                    val argBatches = operation.getArray(3)!!

                    for (j in 0 until argBatches.size()) {
                        val args = argBatches.getArray(j)!!.toArrayList().toArray()
                        database.execute(sql, args)
                        if (cacheBehavior != 0) {
                            val id = args[0] as RecordID
                            if (cacheBehavior == 1) {
                                newIds.add(Pair(table, id))
                            } else if (cacheBehavior == -1) {
                                removedIds.add(Pair(table, id))
                            }
                        }
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
            database.unsafeExecuteStatements(schema.sql)
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
