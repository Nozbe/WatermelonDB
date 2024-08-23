/*
 * Copyright (C) 2006 The Android Open Source Project
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

import androidx.annotation.VisibleForTesting;

class SQLiteStatementType {

    /** One of the values returned by {@link #getSqlStatementType(String)}. */
    public static final int STATEMENT_SELECT = 1;
    /** One of the values returned by {@link #getSqlStatementType(String)}. */
    public static final int STATEMENT_UPDATE = 2;
    /** One of the values returned by {@link #getSqlStatementType(String)}. */
    public static final int STATEMENT_ATTACH = 3;
    /** One of the values returned by {@link #getSqlStatementType(String)}. */
    public static final int STATEMENT_BEGIN = 4;
    /** One of the values returned by {@link #getSqlStatementType(String)}. */
    public static final int STATEMENT_COMMIT = 5;
    /** One of the values returned by {@link #getSqlStatementType(String)}. */
    public static final int STATEMENT_ABORT = 6;
    /** One of the values returned by {@link #getSqlStatementType(String)}. */
    public static final int STATEMENT_PRAGMA = 7;
    /** One of the values returned by {@link #getSqlStatementType(String)}. */
    public static final int STATEMENT_DDL = 8;
    /** One of the values returned by {@link #getSqlStatementType(String)}. */
    public static final int STATEMENT_UNPREPARED = 9;
    /** One of the values returned by {@link #getSqlStatementType(String)}. */
    public static final int STATEMENT_OTHER = 99;

    private SQLiteStatementType() {
    }

    /**
     * Returns one of the following which represent the type of the given SQL statement.
     * <ol>
     *   <li>{@link #STATEMENT_SELECT}</li>
     *   <li>{@link #STATEMENT_UPDATE}</li>
     *   <li>{@link #STATEMENT_ATTACH}</li>
     *   <li>{@link #STATEMENT_BEGIN}</li>
     *   <li>{@link #STATEMENT_COMMIT}</li>
     *   <li>{@link #STATEMENT_ABORT}</li>
     *   <li>{@link #STATEMENT_OTHER}</li>
     * </ol>
     * @param sql the SQL statement whose type is returned by this method
     * @return one of the values listed above
     */
    public static int getSqlStatementType(String sql) {
        if (sql.length() < 3) {
            return STATEMENT_OTHER;
        }
        // Skip leading comments to properly recognize the statement type
        int statementStart = statementStartIndex(sql);
        String prefixSql = sql.substring(statementStart, Math.min(statementStart + 3, sql.length()));

        if (prefixSql.equalsIgnoreCase("SEL")
                || prefixSql.equalsIgnoreCase("WIT")) {
            return STATEMENT_SELECT;
        }
        if (prefixSql.equalsIgnoreCase("INS")
                || prefixSql.equalsIgnoreCase("UPD")
                || prefixSql.equalsIgnoreCase("REP")
                || prefixSql.equalsIgnoreCase("DEL")) {
            return STATEMENT_UPDATE;
        }
        if (prefixSql.equalsIgnoreCase("ATT")) {
            return STATEMENT_ATTACH;
        }
        if (prefixSql.equalsIgnoreCase("COM")
                || prefixSql.equalsIgnoreCase("END")) {
            return STATEMENT_COMMIT;
        }
        if (prefixSql.equalsIgnoreCase("ROL")) {
            return STATEMENT_ABORT;
        }
        if (prefixSql.equalsIgnoreCase("BEG")) {
            return STATEMENT_BEGIN;
        }
        if (prefixSql.equalsIgnoreCase("PRA")) {
            return STATEMENT_PRAGMA;
        }
        if (prefixSql.equalsIgnoreCase("CRE")
                || prefixSql.equalsIgnoreCase("DRO")
                || prefixSql.equalsIgnoreCase("ALT")) {
            return STATEMENT_DDL;
        }

        if (prefixSql.equalsIgnoreCase("ANA") || prefixSql.equalsIgnoreCase("DET")) {
            return STATEMENT_UNPREPARED;
        }

        return STATEMENT_OTHER;
    }

    /**
     * @param sql sql statement to check
     * @return index of the SQL statement start, skipping leading comments
     */
    @VisibleForTesting
    static int statementStartIndex(String sql) {
        boolean inSingleLineComment = false;
        boolean inMultiLineComment = false;
        int statementStartIndex = 0;

        for (int i = 0; i < sql.length(); i++) {
            char c = sql.charAt(i);

            if (inSingleLineComment) {
                if (c == '\n') {
                    inSingleLineComment = false;
                }
            } else if (inMultiLineComment) {
                if (c == '*' && i + 1 < sql.length() && sql.charAt(i + 1) == '/') {
                    inMultiLineComment = false;
                }
            } else if (c == '-') {
                if (i + 1 < sql.length() && sql.charAt(i + 1) == '-') {
                    inSingleLineComment = true;
                }
            } else if (c == '/') {
                if (i + 1 < sql.length() && sql.charAt(i + 1) == '*') {
                    inMultiLineComment = true;
                }
            } else if (c != '\n' && c != '\r' && c != ' ' && c != '\t') {
                statementStartIndex = i;
                break;
            }
        }

        return statementStartIndex;
    }
}
