package com.nozbe.watermelondb;

public class Queries {
    public static final String select_local_storage = "select value from local_storage where key = ?";
    public static final String select_tables = "select * from sqlite_master where type='table'";
    public static String dropTable(String table) {
        return "drop table if exists `" + table + "`";
    }
}
