package com.nozbe.watermelondb;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteCursor;
import android.database.sqlite.SQLiteDatabase;

import java.io.File;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

public class WMDatabase {
    private final SQLiteDatabase db;

    private WMDatabase(SQLiteDatabase db) {
        this.db = db;
    }

    public static Map<String, WMDatabase> INSTANCES = new HashMap<>();

    public static WMDatabase getInstance(String name, Context context, int openFlags) {
        synchronized (WMDatabase.class) {
            WMDatabase instance = INSTANCES.getOrDefault(name, null);
            if (instance == null || !instance.isOpen()) {
                WMDatabase database = buildDatabase(name, context, openFlags);
                INSTANCES.put(name, database);
                return database;
            } else {
                return instance;
            }
        }
    }

    public static WMDatabase buildDatabase(String name, Context context, int openFlags) {
        SQLiteDatabase sqLiteDatabase = WMDatabase.createSQLiteDatabase(name, context, openFlags);
        return new WMDatabase(sqLiteDatabase);
    }

    private static SQLiteDatabase createSQLiteDatabase(String name, Context context, int openFlags) {
        String path;
        if (name.equals(":memory:") || name.contains("mode=memory")) {
            context.getCacheDir().delete();
            path = new File(context.getCacheDir(), name).getPath();
        } else {
            // On some systems there is some kind of lock on `/databases` folder ¯\_(ツ)_/¯
            path = context.getDatabasePath("" + name + ".db").getPath().replace("/databases", "");
        }
        return SQLiteDatabase.openDatabase(path, null, openFlags);
    }

    public void setUserVersion(int version) {
        db.setVersion(version);
    }

    public int getUserVersion() {
        return db.getVersion();
    }

    public void unsafeExecuteStatements(String statements) {
        this.transaction(() -> {
            // NOTE: This must NEVER be allowed to take user input - split by `;` is not grammar-aware
            // and so is unsafe. Only works with Watermelon-generated strings known to be safe
            for (String statement : statements.split(";")) {
                if (!statement.trim().isEmpty()) {
                    this.execute(statement);
                }
            }
        });
    }

    public void execute(String query, Object[] args) {
        db.execSQL(query, args);
    }

    public void execute(String query) {
        db.execSQL(query);
    }

    public void delete(String query, Object[] args) {
        db.execSQL(query, args);
    }

    public Cursor rawQuery(String sql, Object[] args) {
        // HACK: db.rawQuery only supports String args, and there's no clean way AFAIK to construct
        // a query with arbitrary args (like with execSQL). However, we can misuse cursor factory
        // to get the reference of a SQLiteQuery before it's executed
        // https://github.com/aosp-mirror/platform_frameworks_base/blob/0799624dc7eb4b4641b4659af5b5ec4b9f80dd81/core/java/android/database/sqlite/SQLiteDirectCursorDriver.java#L30
        // https://github.com/aosp-mirror/platform_frameworks_base/blob/0799624dc7eb4b4641b4659af5b5ec4b9f80dd81/core/java/android/database/sqlite/SQLiteProgram.java#L32
        String[] rawArgs = new String[args.length];
        Arrays.fill(rawArgs, "");
        return db.rawQueryWithFactory(
                (db1, driver, editTable, query) -> {
                    for (int i = 0; i < args.length; i++) {
                        Object arg = args[i];
                        if (arg instanceof String) {
                            query.bindString(i + 1, (String) arg);
                        } else if (arg instanceof Boolean) {
                            query.bindLong(i + 1, (Boolean) arg ? 1 : 0);
                        } else if (arg instanceof Double) {
                            query.bindDouble(i + 1, (Double) arg);
                        } else if (arg == null) {
                            query.bindNull(i + 1);
                        } else {
                            throw new IllegalArgumentException("Bad query arg type: " + arg.getClass().getCanonicalName());
                        }
                    }
                    return new SQLiteCursor(driver, editTable, query);
                }, sql, rawArgs, null, null
        );
    }

    public Cursor rawQuery(String sql) {
        return rawQuery(sql, new Object[] {});
    }

    public int count(String query, Object[] args) {
        try (Cursor cursor = rawQuery(query, args)) {
            cursor.moveToFirst();
            int columnIndex = cursor.getColumnIndex("count");
            if (cursor.getCount() > 0) {
                return cursor.getInt(columnIndex);
            } else {
                return 0;
            }
        }
    }

    public int count(String query) {
        return this.count(query, new Object[]{});
    }

    public String getFromLocalStorage(String key) {
        try (Cursor cursor = rawQuery(Queries.select_local_storage, new Object[]{key})) {
            cursor.moveToFirst();
            if (cursor.getCount() > 0) {
                return cursor.getString(0);
            } else {
                return null;
            }
        }
    }

    private ArrayList<String> getAllTables() {
        ArrayList<String> allTables = new ArrayList<>();
        try (Cursor cursor = rawQuery(Queries.select_tables)) {
            cursor.moveToFirst();
            int nameIndex = cursor.getColumnIndex("name");
            if (nameIndex > -1) {
                do {
                    allTables.add(cursor.getString(nameIndex));
                } while (cursor.moveToNext());
            }
        }
        return allTables;
    }

    public void unsafeDestroyEverything() {
        this.transaction(() -> {
            for (String tableName : getAllTables()) {
                execute(Queries.dropTable(tableName));
            }
            execute("pragma writable_schema=1");
            execute("delete from sqlite_master where type in ('table', 'index', 'trigger')");
            execute("pragma user_version=0");
            execute("pragma writable_schema=0");
        });
    }

    interface TransactionFunction {
        void applyTransactionFunction();
    }

    public void transaction(TransactionFunction function) {
        db.beginTransaction();
        try {
            function.applyTransactionFunction();
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }

    public Boolean isOpen() {
        return db.isOpen();
    }

    public void close() {
        db.close();
    }
}
