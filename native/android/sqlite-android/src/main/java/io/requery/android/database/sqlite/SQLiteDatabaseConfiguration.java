/*
 * Copyright (C) 2011 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// modified from original source see README at the top level of this project

package io.requery.android.database.sqlite;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Describes how to configure a database.
 * <p>
 * The purpose of this object is to keep track of all of the little
 * configuration settings that are applied to a database after it
 * is opened so that they can be applied to all connections in the
 * connection pool uniformly.
 * </p><p>
 * Each connection maintains its own copy of this object so it can
 * keep track of which settings have already been applied.
 * </p>
 *
 * @hide
 */
public final class SQLiteDatabaseConfiguration {
    // The pattern we use to strip email addresses from database paths
    // when constructing a label to use in log messages.
    private static final Pattern EMAIL_IN_DB_PATTERN =
            Pattern.compile("[\\w\\.\\-]+@[\\w\\.\\-]+");

    /**
     * Special path used by in-memory databases.
     */
    public static final String MEMORY_DB_PATH = ":memory:";

    /**
     * The database path.
     */
    public final String path;

    /**
     * The label to use to describe the database when it appears in logs.
     * This is derived from the path but is stripped to remove PII.
     */
    public final String label;

    /**
     * The flags used to open the database.
     */
    public @SQLiteDatabase.OpenFlags int openFlags;

    public SQLiteUpdateHook sqliteUpdateHook;

    /**
     * The maximum size of the prepared statement cache for each database connection.
     * Must be non-negative.
     *
     * Default is 25.
     */
    public int maxSqlCacheSize;

    /**
     * The database locale.
     *
     * Default is the value returned by {@link Locale#getDefault()}.
     */
    public Locale locale;

    /**
     * True if foreign key constraints are enabled.
     *
     * Default is false.
     */
    public boolean foreignKeyConstraintsEnabled;

    /**
     * The custom functions to register.
     *
     * This interface is deprecated; see {@link SQLiteFunction}
     */
    @Deprecated
    public final List<SQLiteCustomFunction> customFunctions = new ArrayList<>();

    /**
     * The {@link SQLiteFunction}s to register.
     */
    public final List<SQLiteFunction> functions = new ArrayList<>();

    /**
     * The custom extensions to register.
     */
    public final List<SQLiteCustomExtension> customExtensions = new ArrayList<>();

    /**
     * Creates a database configuration with the required parameters for opening a
     * database and default values for all other parameters.
     *
     * @param path The database path.
     * @param openFlags Open flags for the database, such as {@link SQLiteDatabase#OPEN_READWRITE}.
     */
    public SQLiteDatabaseConfiguration(String path, @SQLiteDatabase.OpenFlags int openFlags) {
        if (path == null) {
            throw new IllegalArgumentException("path must not be null.");
        }

        this.path = path;
        label = stripPathForLogs(path);
        this.openFlags = openFlags;

        // Set default values for optional parameters.
        maxSqlCacheSize = 25;
        locale = Locale.getDefault();
    }

    /**
     * Creates a database configuration with the required parameters for opening a
     * database and default values for all other parameters.
     *
     * @param path The database path.
     * @param openFlags Open flags for the database, such as {@link SQLiteDatabase#OPEN_READWRITE}.
     * @param functions custom functions to use.
     * @param extensions custom extensions to use.
     */
    public SQLiteDatabaseConfiguration(String path,
                                       @SQLiteDatabase.OpenFlags int openFlags,
                                       List<SQLiteCustomFunction> customFunctions,
                                       List<SQLiteFunction> functions,
                                       List<SQLiteCustomExtension> extensions) {
        this(path, openFlags);
        this.customFunctions.addAll(customFunctions);
        this.customExtensions.addAll(extensions);
        this.functions.addAll(functions);
    }

    /**
     * Creates a database configuration as a copy of another configuration.
     *
     * @param other The other configuration.
     */
    SQLiteDatabaseConfiguration(SQLiteDatabaseConfiguration other) {
        if (other == null) {
            throw new IllegalArgumentException("other must not be null.");
        }

        this.path = other.path;
        this.label = other.label;
        updateParametersFrom(other);
    }

    /**
     * Updates the non-immutable parameters of this configuration object
     * from the other configuration object.
     *
     * @param other The object from which to copy the parameters.
     */
    void updateParametersFrom(SQLiteDatabaseConfiguration other) {
        if (other == null) {
            throw new IllegalArgumentException("other must not be null.");
        }
        if (!path.equals(other.path)) {
            throw new IllegalArgumentException("other configuration must refer to "
                    + "the same database.");
        }

        openFlags = other.openFlags;
        maxSqlCacheSize = other.maxSqlCacheSize;
        locale = other.locale;
        foreignKeyConstraintsEnabled = other.foreignKeyConstraintsEnabled;
        customFunctions.clear();
        customFunctions.addAll(other.customFunctions);
        customExtensions.clear();
        customExtensions.addAll(other.customExtensions);
        functions.clear();
        functions.addAll(other.functions);
        sqliteUpdateHook = other.sqliteUpdateHook;
    }

    /**
     * Returns true if the database is in-memory.
     * @return True if the database is in-memory.
     */
    public boolean isInMemoryDb() {
        return path.equalsIgnoreCase(MEMORY_DB_PATH);
    }

    private static String stripPathForLogs(String path) {
        if (path.indexOf('@') == -1) {
            return path;
        }
        return EMAIL_IN_DB_PATTERN.matcher(path).replaceAll("XX@YY");
    }
}
