package com.nozbe.watermelondb;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteCursor;
import android.database.sqlite.SQLiteDatabase;

import java.io.File;
import java.util.List;
import java.util.Map;

public class Database {
    private final SQLiteDatabase db;

    private Database(SQLiteDatabase db) {
        this.db = db;
    }

    public static Map<String, Database> INSTANCES;

    public static Database getInstance(String name, Context context, int openFlags) {
        synchronized (Database.class) {
            if (!INSTANCES.containsKey(name) || !(INSTANCES.get(name) == null && INSTANCES.get(name).isOpen())) {
                Database database = buildDatabase(name, context, openFlags);
                INSTANCES.put(name, database);
                return database;
            } else {
                return INSTANCES.get(name);
            }
        }
    }

    public static Database buildDatabase(String name, Context context, int openFlags) {
        SQLiteDatabase sqLiteDatabase = Database.createSQLiteDatabase(name, context, openFlags);
        return new Database(sqLiteDatabase);
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
        String[] rawArgs = new String[args.length];
        return db.rawQueryWithFactory(
                (db1, driver, editTable, query1) -> {
                    for (int i = 0; i < args.length; i++) {
                        Object arg = args[i];
                        if (arg instanceof String) {
                            query1.bindString(i + 1, (String) arg);
                        } else if (arg instanceof Boolean) {
                            query1.bindLong(i + 1, (Boolean) arg ? 1 : 0);
                        } else if (arg instanceof Double) {
                            query1.bindDouble(i + 1, (Double) arg);
                        } else if (arg == null) {
                            query1.bindNull(i + 1);
                        } else {
                            throw new IllegalArgumentException("Bad query arg type: " + arg.getClass().getCanonicalName());
                        }
                    }
                    return new SQLiteCursor(driver, editTable, query1);
                }, sql, rawArgs, null, null
        );
    }

    public Cursor rawQuery(String sql) {
        return rawQuery(sql, new Object[] {});
    }

    public String count(String query, Object[] args) {
        try (Cursor cursor = rawQuery(query, args)) {
            cursor.moveToFirst();
            if (cursor.getCount() > 0) {
                return cursor.getString(0);
            } else {
                return null;
            }
        }
    }

    public String count(String query) {
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

    private List<String> getAllTables() {
        List<String> allTables = List.of();
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
        void apply();
    }

    public void transaction(TransactionFunction function) {
        db.beginTransaction();
        try {
            function.apply();
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
