package com.nozbe.watermelondb

object Queries {
    const val select_local_storage = "select value from local_storage where key = ?"
    const val select_tables = "select * from sqlite_master where type='table'"
    fun dropTable(table: String) = "drop table if exists `$table`"
}
