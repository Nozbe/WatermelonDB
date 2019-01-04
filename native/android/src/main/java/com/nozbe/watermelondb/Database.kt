package com.nozbe.watermelondb

import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import java.io.File

class Database(private val name: String, private val context: Context) {

    private val db: SQLiteDatabase by lazy {
        SQLiteDatabase.openOrCreateDatabase(
                // TODO: This SUCKS. Seems like Android doesn't like sqlite `?mode=memory&cache=shared` mode. To avoid random breakages, save the file to /tmp, but this is slow.
                if (name == ":memory:" || name.contains("mode=memory")) {
                    context.cacheDir.delete()
                    File(context.cacheDir, name).path
                } else
                    // On some systems there is some kind of lock on `/databases` folder ¯\_(ツ)_/¯
                    context.getDatabasePath("$name.db").path.replace("/databases", ""),
                null)
    }

    var userVersion: Int
        get() = db.version
        set(value) {
            db.version = value
        }

    fun executeStatements(statements: SQL) =
            transaction {
                statements.split(";").forEach {
                    if (it.isNotBlank()) execute(it)
                }
            }

    fun execute(query: SQL, values: QueryArgs = arrayListOf()) =
            db.execSQL(query, values.toArray())

    fun delete(query: SQL, queryArgs: QueryArgs) = db.execSQL(query, queryArgs.toArray())

    fun rawQuery(query: SQL, key: RawQueryArgs = emptyArray()): Cursor = db.rawQuery(query, key)

    fun getFromLocalStorage(key: String): String? =
            rawQuery(Queries.select_local_storage, arrayOf(key)).use {
                it.moveToFirst()
                return if (it.count > 0) {
                    it.getString(0)
                } else {
                    null
                }
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

//    fun unsafeResetDatabase() = context.deleteDatabase("$name.db")

    fun unsafeDestroyEverything() =
            transaction {
                getAllTables().forEach { execute(Queries.dropTable(it)) }
                execute("pragma writable_schema=1")
                execute("delete from sqlite_master where type in ('table', 'index', 'trigger'")
                execute("pragma user_version=0")
                execute("pragma writable_schema=0")
            }

    private fun getAllTables(): ArrayList<String> {
        val allTables: ArrayList<String> = arrayListOf()
        rawQuery(Queries.select_tables).use {
            it.moveToFirst()
            val index = it.getColumnIndex("name")
            if (index > -1) {
                do {
                    allTables.add(it.getString(index))
                } while (it.moveToNext())
            }
        }
        return allTables
    }

    fun transaction(function: () -> Unit) {
        db.beginTransaction()
        try {
            function()
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun close() = db.close()
}
