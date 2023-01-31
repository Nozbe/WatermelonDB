package com.nozbe.watermelondb.utils;

/**
 * typealias SQL = String
 * typealias RecordID = String
 * typealias TableName = String
 * typealias QueryArgs = Array<Any?>
 * typealias RawQueryArgs = Array<String>
 * typealias ConnectionTag = Int
 * typealias SchemaVersion = Int
 */
public class Schema {
    public int version;
    public String sql;

    public Schema(int version, String sql) {
        this.version = version;
        this.sql = sql;
    }
}
