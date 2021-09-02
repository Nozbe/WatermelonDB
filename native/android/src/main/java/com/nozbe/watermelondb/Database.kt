package com.nozbe.watermelondb

import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteCursor
import android.database.sqlite.SQLiteCursorDriver
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteQuery
import java.io.File

class Database(private val name: String, private val context: Context, private val openFlags: Int = SQLiteDatabase.CREATE_IF_NECESSARY or SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING) {

    private val db: SQLiteDatabase by lazy {
        // TODO: This SUCKS. Seems like Android doesn't like sqlite `?mode=memory&cache=shared` mode. To avoid random breakages, save the file to /tmp, but this is slow.
        // NOTE: This is because Android system SQLite is not compiled with SQLITE_USE_URI=1
        // issue `PRAGMA cache=shared` query after connection when needed
        val path =
            if (name == ":memory:" || name.contains("mode=memory")) {
                context.cacheDir.delete()
                File(context.cacheDir, name).path
            } else {
                // On some systems there is some kind of lock on `/databases` folder ¯\_(ツ)_/¯
                context.getDatabasePath("$name.db").path.replace("/databases", "")
            }
        return@lazy SQLiteDatabase.openDatabase(path, null, openFlags)
    }

    var userVersion: Int
        get() = db.version
        set(value) {
            db.version = value
        }

    fun unsafeExecuteStatements(statements: SQL) =
            transaction {
                // NOTE: This must NEVER be allowed to take user input - split by `;` is not grammar-aware
                // and so is unsafe. Only works with Watermelon-generated strings known to be safe
                statements.split(";").forEach {
                    if (it.isNotBlank()) execute(it)
                }
            }

    fun execute(query: SQL, args: QueryArgs = emptyArray()) =
            db.execSQL(query, args)

    fun delete(query: SQL, args: QueryArgs) = db.execSQL(query, args)

    fun rawQuery(sql: SQL, args: QueryArgs = emptyArray()): Cursor {
        // HACK: db.rawQuery only supports String args, and there's no clean way AFAIK to construct
        // a query with arbitrary args (like with execSQL). However, we can misuse cursor factory
        // to get the reference of a SQLiteQuery before it's executed
        // https://github.com/aosp-mirror/platform_frameworks_base/blob/0799624dc7eb4b4641b4659af5b5ec4b9f80dd81/core/java/android/database/sqlite/SQLiteDirectCursorDriver.java#L30
        // https://github.com/aosp-mirror/platform_frameworks_base/blob/0799624dc7eb4b4641b4659af5b5ec4b9f80dd81/core/java/android/database/sqlite/SQLiteProgram.java#L32
        val rawArgs = Array(args.size) { "" }
        return db.rawQueryWithFactory(
            { _, driver: SQLiteCursorDriver?, editTable: String?, query: SQLiteQuery ->
                args.withIndex().forEach { (i, arg) ->
                    when (arg) {
                        is String -> query.bindString(i + 1, arg)
                        is Boolean -> query.bindLong(i + 1, if (arg) 1 else 0)
                        is Double -> query.bindDouble(i + 1, arg)
                        null -> query.bindNull(i + 1)
                        else -> throw IllegalArgumentException("Bad query arg type: ${arg::class.java.canonicalName}")
                    }
                }
                SQLiteCursor(driver, editTable, query)
            }, sql, rawArgs, null, null
        )
    }

    fun count(query: SQL, args: QueryArgs = emptyArray()): Int =
            rawQuery(query, args).use {
                it.moveToFirst()
                return it.getInt(it.getColumnIndex("count"))
            }

    fun getFromLocalStorage(key: String): String? =
            rawQuery(Queries.select_local_storage, arrayOf(key)).use {
                it.moveToFirst()
                return if (it.count > 0) {
                    it.getString(0)
                } else {
                    null
                }
            }

//    fun unsafeResetDatabase() = context.deleteDatabase("$name.db")

    fun unsafeDestroyEverything() =
            transaction {
                getAllTables().forEach { execute(Queries.dropTable(it)) }
                execute("pragma writable_schema=1")
                execute("delete from sqlite_master where type in ('table', 'index', 'trigger')")
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
