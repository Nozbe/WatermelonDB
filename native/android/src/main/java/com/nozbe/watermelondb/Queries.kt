package com.nozbe.watermelondb

object Queries {
    const val select_local_storage = "select value from local_storage where key = ?"
    const val insert_local_storage =
            "insert or replace into local_storage (key, value) values (?, ?)"
    const val delete_local_storage = "delete from local_storage where key == ?"
    const val select_tables = "select * from sqlite_master where type='table'"
    fun dropTable(table: String) = "drop table if exists $table"
    fun destroyPermanently(table: String) = "delete from $table where id == ?"
    fun setStatusDeleted(table: String) = "update $table set _status='deleted' where id == ?"
    fun selectDeletedIdsFromTable(table: String) = "select id from $table where _status='deleted'"
    fun multipleDeleteFromTable(table: String, args: QueryArgs) =
            "delete from $table where id in ${args.preparePlaceholder()}"
    const val localStorageSchema = """
        create table local_storage (
        key varchar(16) primary key not null,
        value text not null
        );

        create index local_storage_key_index on local_storage (key);
    """

    private fun QueryArgs.preparePlaceholder(): String =
            "(${this.joinToString { _ -> "?" }})"
}
