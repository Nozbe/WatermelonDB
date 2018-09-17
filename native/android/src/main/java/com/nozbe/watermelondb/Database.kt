package com.nozbe.watermelondb

import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import java.util.logging.Logger

class Database(private val name: String?, private val context: Context) {

    private val log = if (BuildConfig.DEBUG) Logger.getLogger("Database") else null

    private val db: SQLiteDatabase by lazy {
        if (name.isNullOrBlank() || name == "test") {
            SQLiteDatabase.create(null)
        } else {
            // On some systems there is some kind of lock on `/databases` folder ¯\_(ツ)_/¯
            SQLiteDatabase.openOrCreateDatabase(
                    context.getDatabasePath("$name.db").path
                            .replace("/databases", ""), null)
        }
    }

    var userVersion: Int
        get() = db.version
        set(value) {
            db.version = value
        }

    fun executeSchema(schema: SQL, schemaVersion: Int) {
        log?.info("[Setting up database] clearing")
        clear()
        log?.info("[Setting up database] creating tables")
        db.transaction {
            schema.split(";").forEach {
                if (it.isNotBlank()) execute(it)
            }
            userVersion = schemaVersion
        }
        log?.info("[Setting up database] done")
    }

    fun execute(query: SQL, values: QueryArgs = arrayListOf()) = db.execSQL(query, values.toArray())

    fun delete(query: SQL, queryArgs: QueryArgs) = db.execSQL(query, queryArgs.toArray())

    fun rawQuery(query: SQL, key: RawQueryArgs = emptyArray()): Cursor = db.rawQuery(query, key)

    fun getFromLocalStorage(key: String): String? =
            rawQuery(Queries.select_local_storage, arrayOf(key)).use {
                it.moveToFirst()
                return if (it.count > 0) it.getString(0) else null
            }

    fun insertToLocalStorage(key: String, value: String) =
            execute(Queries.insert_local_storage, arrayListOf(key, value))

    fun deleteFromLocalStorage(key: String) =
            execute(Queries.delete_local_storage, arrayListOf(key))

    fun count(query: SQL, values: RawQueryArgs = emptyArray()): Int =
            rawQuery(query, values).use {
                it.moveToFirst()
                return it.getInt(it.getColumnIndex("count"))
            }

    fun unsafeResetDatabase(): Boolean = context.deleteDatabase(name)

    fun inTransaction(function: () -> Unit) = db.transaction { function() }

    private fun clear() =
            db.transaction { getAllTables().forEach { execute(Queries.dropTable(it)) } }

    private fun getAllTables(): ArrayList<String> {
        val allTables: ArrayList<String> = arrayListOf()
        rawQuery(Queries.select_tables).use {
            it.moveToFirst()
            val index = it.getColumnIndex("name")
            if (index > -1) {
                while (it.moveToNext()) {
                    allTables.add(it.getString(index))
                }
            }
        }
        return allTables
    }

    fun close() = db.close()
}
