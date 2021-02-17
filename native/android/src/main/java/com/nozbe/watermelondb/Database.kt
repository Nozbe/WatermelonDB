package com.nozbe.watermelondb

import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import java.io.File

class Database(private val name: String, private val context: Context) {

    private val db: SQLiteDatabase by lazy {
        SQLiteDatabase.openOrCreateDatabase(
                // TODO: This SUCKS. Seems like Android doesn't like sqlite `?mode=memory&cache=shared` mode. To avoid random breakages, save the file to /tmp, but this is slow.
                // NOTE: This is because Android system SQLite is not compiled with SQLITE_USE_URI=1
                // issue `PRAGMA cache=shared` query after connection when needed
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

    fun unsafeExecuteStatements(statements: SQL) =
            transaction {
                // NOTE: This must NEVER be allowed to take user input - split by `;` is not grammer-aware
                // and so is unsafe. Only works with Watermelon-generated strings known to be safe

                // NOTE: We do not want to split if the ';' is followed by 'END;' as that leads to an
                // incomplete statement. Triggers need BEGIN...statement;...END; syntax.
                val regex = ";(?!\\s*END\\s*;)".toRegex(RegexOption.IGNORE_CASE)

                statements.split(regex).forEach {
                    if (it.isNotBlank()) execute(it)
                }
            }

    fun execute(query: SQL, args: QueryArgs = emptyArray()) =
            db.execSQL(query, args)

    fun delete(query: SQL, args: QueryArgs) = db.execSQL(query, args)

    fun rawQuery(query: SQL, args: RawQueryArgs = emptyArray()): Cursor = db.rawQuery(query, args)

    fun count(query: SQL, args: RawQueryArgs = emptyArray()): Int =
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

    fun insertToLocalStorage(key: String, value: String) =
            execute(Queries.insert_local_storage, arrayOf(key, value))

    fun deleteFromLocalStorage(key: String) =
            execute(Queries.delete_local_storage, arrayOf(key))

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
