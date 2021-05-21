package com.nozbe.watermelondb

object Queries {
    const val select_local_storage = "select value from local_storage where key = ?"
    const val select_tables = "select * from sqlite_master where type='table'"
    fun dropTable(table: String) = "drop table if exists `$table`"

    const val localStorageSchema = """
        create table local_storage (
        key varchar(16) primary key not null,
        value text not null
        );

        create index local_storage_key_index on local_storage (key);
    """
}
