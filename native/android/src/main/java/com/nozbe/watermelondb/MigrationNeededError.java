package com.nozbe.watermelondb;

public class MigrationNeededError extends RuntimeException {
    public int databaseVersion;

    public MigrationNeededError(int databaseVersion) {
        this.databaseVersion = databaseVersion;
    }
}
