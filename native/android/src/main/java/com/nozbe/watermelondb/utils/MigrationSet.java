package com.nozbe.watermelondb.utils;

public class MigrationSet {
    public int from;
    public int to;
    public String sql;

    public MigrationSet(int from, int to, String sql) {
        this.from = from;
        this.to = to;
        this.sql = sql;
    }
}
