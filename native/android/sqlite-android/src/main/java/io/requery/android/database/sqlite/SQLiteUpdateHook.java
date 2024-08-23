package io.requery.android.database.sqlite;

public interface SQLiteUpdateHook {
    void onUpdateFromNative(int operationType, String databaseName, String tableName, long rowId);
}
