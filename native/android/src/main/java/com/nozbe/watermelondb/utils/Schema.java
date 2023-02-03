package com.nozbe.watermelondb.utils;

public class Schema {
    public int version;
    public String sql;

    public Schema(int version, String sql) {
        this.version = version;
        this.sql = sql;
    }
}
