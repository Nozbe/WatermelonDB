//
//  DatabaseUtils.cpp
//  WatermelonDB
//
//  Created by BuildOpsLA27 on 10/4/24.
//

#include "DatabaseUtils.h"

namespace watermelondb {

jsi::JSError dbError(jsi::Runtime &rt, sqlite3* db, std::string description) {
    // TODO: In serialized threading mode, those may be incorrect - probably smarter to pass result codes around?
    auto sqliteMessage = std::string(sqlite3_errmsg(db));
    auto code = sqlite3_extended_errcode(db);
    auto message = description + " - sqlite error " + std::to_string(code) + " (" + sqliteMessage + ")";
    return jsi::JSError(rt, message);
}

SqliteStatement getStmt(jsi::Runtime &rt, sqlite3* db, std::string sql, const jsi::Array &arguments) {
    sqlite3_stmt *statement;
    
    int resultPrepare = sqlite3_prepare_v2(db, sql.c_str(), -1, &statement, nullptr);
    
    if (resultPrepare != SQLITE_OK) {
        sqlite3_finalize(statement);
        throw dbError(rt, db, "Failed to prepare query statement");
    }
    
    assert(statement != nullptr);
    
    
    int argsCount = sqlite3_bind_parameter_count(statement);
    
    if (argsCount != arguments.length(rt)) {
        sqlite3_reset(statement);
        throw jsi::JSError(rt, "Number of args passed to query doesn't match number of arg placeholders");
    }
    
    for (int i = 0; i < argsCount; i++) {
        jsi::Value value = arguments.getValueAtIndex(rt, i);
        
        int bindResult;
        if (value.isNull() || value.isUndefined()) {
            bindResult = sqlite3_bind_null(statement, i + 1);
        } else if (value.isString()) {
            // TODO: Check SQLITE_STATIC
            bindResult = sqlite3_bind_text(statement, i + 1, value.getString(rt).utf8(rt).c_str(), -1, SQLITE_TRANSIENT);
        } else if (value.isNumber()) {
            bindResult = sqlite3_bind_double(statement, i + 1, value.getNumber());
        } else if (value.isBool()) {
            bindResult = sqlite3_bind_int(statement, i + 1, value.getBool());
        } else if (value.isObject()) {
            sqlite3_reset(statement);
            throw jsi::JSError(rt, "Invalid argument type (object) for query");
        } else {
            sqlite3_reset(statement);
            throw jsi::JSError(rt, "Invalid argument type (unknown) for query");
        }
        
        if (bindResult != SQLITE_OK) {
            sqlite3_reset(statement);
            throw dbError(rt, db, "Failed to bind an argument for query");
        }
    }
    
    // TODO: We may move this initialization earlier to avoid having to care about sqlite3_reset, but I think we'll
    // have to implement a move constructor for it to be correct
    return SqliteStatement(statement);
}

jsi::Array arrayFromStd(jsi::Runtime &rt, std::vector<jsi::Value> &vector) {
    // FIXME: Adding directly to a jsi::Array should be more efficient, but Hermes does not support
    // automatically resizing an Array by setting new values to it
    jsi::Array array(rt, vector.size());
    
    size_t i = 0;
    
    for (auto const &value : vector) {
        array.setValueAtIndex(rt, i, value);
        i++;
    }
    
    return array;
}

jsi::Object resultDictionary(jsi::Runtime &rt, sqlite3_stmt *statement) {
    jsi::Object dictionary(rt);

    for (int i = 0, len = sqlite3_column_count(statement); i < len; i++) {
        const char *column = sqlite3_column_name(statement, i);
        assert(column);

        auto type = sqlite3_column_type(statement, i);
        if (type == SQLITE_INTEGER) {
            sqlite3_int64 value = sqlite3_column_int64(statement, i);
            dictionary.setProperty(rt, column, jsi::Value((double)value));
        } else if (type == SQLITE_FLOAT) {
            double value = sqlite3_column_double(statement, i);
            dictionary.setProperty(rt, column, jsi::Value(value));
        } else if (type == SQLITE_TEXT) {
            const char *text = (const char *)sqlite3_column_text(statement, i);
            if (text) {
                dictionary.setProperty(rt, column, jsi::String::createFromUtf8(rt, text));
            } else {
                dictionary.setProperty(rt, column, jsi::Value::null());
            }
        } else if (type == SQLITE_NULL) {
            dictionary.setProperty(rt, column, jsi::Value::null());
        } else {
            throw jsi::JSError(rt, "Unable to fetch record from database - unknown column type (WatermelonDB does not support blobs or custom sqlite types");
        }
    }

    return dictionary; // TODO: Make sure this value is moved, not copied
}

bool getNextRowOrTrue(jsi::Runtime &rt, sqlite3_stmt *stmt) {
    int result = sqlite3_step(stmt);

    if (result == SQLITE_DONE) {
        return true;
    } else if (result != SQLITE_ROW) {
        throw jsi::JSError(rt, "Failed to get a row for query");
    }

    return false;
}


}
