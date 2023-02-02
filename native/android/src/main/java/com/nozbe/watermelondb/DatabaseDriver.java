package com.nozbe.watermelondb;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;

import com.nozbe.watermelondb.utils.MigrationSet;
import com.nozbe.watermelondb.utils.Schema;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Logger;

public class DatabaseDriver {
    private Context context;
    private String dbName;
    private boolean unsafeNativeReuse;

    private Database database;

    private Logger log;
    private Map<String, List<String>> cachedRecords;

    public DatabaseDriver(Context context, String dbName) {
        this(context, dbName, false);
    }

    public DatabaseDriver(Context context, String dbName, int schemaVersion) {
        this(context, dbName, false);
        SchemaCompatibility compatibility = isCompatible(schemaVersion);
        if (compatibility instanceof SchemaCompatibility.NeedsSetup) {
            throw new SchemaNeededError();
        } else if (compatibility instanceof SchemaCompatibility.NeedsMigration) {
            throw new MigrationNeededError(
                    ((SchemaCompatibility.NeedsMigration) compatibility).fromVersion
            );

        }

    }

    public DatabaseDriver(Context context, String dbName, Schema schema) {
        this(context, dbName, false);
        unsafeResetDatabase(schema);
    }

    public DatabaseDriver(Context context, String dbName, MigrationSet migrations) {
        this(context, dbName, false);
        migrate(migrations);
    }

    public DatabaseDriver(Context context, String dbName, boolean unsafeNativeReuse) {
        this.context = context;
        this.dbName = dbName;
        this.unsafeNativeReuse = unsafeNativeReuse;
        this.database = unsafeNativeReuse ? Database.getInstance(dbName, context,
                SQLiteDatabase.CREATE_IF_NECESSARY |
                        SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING) :
                Database.Companion.buildDatabase(dbName, context,
                        SQLiteDatabase.CREATE_IF_NECESSARY |
                                SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING);
        if (BuildConfig.DEBUG) {
            this.log = Logger.getLogger("DB_Driver");
        } else {
            this.log = null;
        }
        this.cachedRecords = new HashMap<>();
    }

    private void markAsCached(String table, String id) {
        // log.info("Mark as cached " + id);
        List<String> cache = cachedRecords.get(table);
        if (cache == null) {
            cache = new ArrayList<>();
        }
        cache.add(id);
        cachedRecords.put(table, cache);
    }

    private boolean isCached(String table, String id) {
        List<String> cache = cachedRecords.get(table);
        return cache != null && cache.contains(id);
    }

    private void removeFromCache(String table, String id) {
        List<String> cache = cachedRecords.get(table);
        if (cache != null) {
            cache.remove(id);
            cachedRecords.put(table, cache);
        }
    }


    public Object find(String table, String id) {
        if (isCached(table, id)) {
            return id;
        }
        try (Cursor cursor = database.rawQuery("select * from `" + table + "` where id == ? limit 1", new String[]{id})) {
            if (cursor.getCount() <= 0) {
                return null;
            }
            markAsCached(table, id);
            cursor.moveToFirst();
            return DatabaseUtils.cursorToMap(cursor);
        }
    }

    public void close() {
        database.close();
    }

    private void migrate(MigrationSet migrations) {
        int databaseVersion = database.getUserVersion();
        if (databaseVersion != migrations.from) {
            throw new IllegalArgumentException("Incompatible migration set applied. " +
                    "DB: " + databaseVersion + ", migration: " + migrations.from);
        }

        database.beginTransaction();
        try {
            database.execSQL(migrations.sql);
            database.setUserVersion(migrations.to);
            database.setTransactionSuccessful();
        } catch (Exception e) {
            log.info("Error while migrating database");
        } finally {
            database.endTransaction();
        }
    }

    private void unsafeResetDatabase(Schema schema) {
        if (log != null) {
            log.info("Unsafe reset database");
        }
        database.unsafeDestroyEverything();
        cachedRecords.clear();
        database.beginTransaction();
        try {
            database.unsafeExecuteStatements(schema.sql);
            database.setUserVersion(schema.version);
        } catch (Exception e) {
            log.info("Error while reseting database");
        } finally {
            database.endTransaction();
        }
    }

    private static class SchemaCompatibility {
        static class Compatible extends SchemaCompatibility {
        }

        static class NeedsSetup extends SchemaCompatibility {
        }

        static class NeedsMigration extends SchemaCompatibility {
            final int fromVersion;

            NeedsMigration(int fromVersion) {
                this.fromVersion = fromVersion;
            }
        }
    }

    private SchemaCompatibility isCompatible(int schemaVersion) {
        int databaseVersion = database.getUserVersion();
        if (databaseVersion == schemaVersion) {
            return new SchemaCompatibility.Compatible();
        } else if (databaseVersion == 0) {
            return new SchemaCompatibility.NeedsSetup();
        } else if (databaseVersion < schemaVersion) {
            return new SchemaCompatibility.NeedsMigration(databaseVersion);
        } else {
            log.info("Database has newer version (" + databaseVersion + ") than what the " +
                    "app supports (" + schemaVersion + "). Will reset database.");
            return new SchemaCompatibility.NeedsSetup();
        }
    }
}
