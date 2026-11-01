#include "Database.h"

// TODO: The split between Database-sqlite.cpp and Sqlite.cpp is confusing…
// Maybe we should either just merge them?
// Or create another layer of abstraction for JSI-capable SQlite, but without Watermelon-specific logic?
namespace watermelondb {

using platform::consoleError;
using platform::consoleLog;

SqliteStatement Database::prepareQuery(std::string sql) {
    auto cached = cachedStatements_.find(sql);

    if (cached != cachedStatements_.end()) {
        // most recently used entries go to the front, so the least recently used ones are evicted first
        statementCache_.splice(statementCache_.begin(), statementCache_, cached->second);
        CachedStatement &entry = *cached->second;
        assert(entry.stmt != nullptr);
        // in theory, this shouldn't be necessary, since statements ought to be reset *after* use, not before use
        // but still this might prevent some crashes if this is not done right
        // TODO: Remove this later - should not be necessary, and it wastes time
        sqlite3_reset(entry.stmt);
        return SqliteStatement(entry.stmt, &entry.pinCount);
    }

    sqlite3_stmt *statement = nullptr;
    int resultPrepare = sqlite3_prepare_v2(db_->sqlite, sql.c_str(), -1, &statement, nullptr);

    if (resultPrepare != SQLITE_OK) {
        sqlite3_finalize(statement);
        throw dbError("Failed to prepare query statement");
    }
    if (statement == nullptr) {
        // NOTE: sqlite3_prepare_v2 succeeds without a statement if the SQL is empty or only a comment
        throw jsi::JSError(getRt(), "Failed to prepare query statement - the query is empty");
    }

    evictCachedStatements();
    statementCache_.push_front({ sql, statement, 0 });
    cachedStatements_[sql] = statementCache_.begin();

    CachedStatement &entry = statementCache_.front();
    return SqliteStatement(entry.stmt, &entry.pinCount);
}

// Finalizes least recently used statements until there is room for one more in the cache.
// Statements pinned by a live SqliteStatement (i.e. still in use by a caller) are skipped.
void Database::evictCachedStatements() {
    auto it = statementCache_.end();
    while (statementCache_.size() >= maxCachedStatements_ && it != statementCache_.begin()) {
        --it;
        if (it->pinCount > 0) {
            continue;
        }
        sqlite3_finalize(it->stmt);
        cachedStatements_.erase(it->sql);
        it = statementCache_.erase(it);
    }
}

void Database::bindArgs(sqlite3_stmt *statement, jsi::Array &arguments) {
    auto &rt = getRt();
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
            throw dbError("Failed to bind an argument for query");
        }
    }
}

std::string Database::bindArgsAndReturnId(sqlite3_stmt *statement, simdjson::ondemand::array &args) {
    using namespace simdjson;
    auto &rt = getRt();
    std::string returnId = "";

    int argsCount = sqlite3_bind_parameter_count(statement);
    int i = 0;
    for (auto arg : args) {
        int bindResult;
        ondemand::json_type type = arg.type();

        if (type == ondemand::json_type::string) {
            std::string_view stringView = arg;
            bindResult = sqlite3_bind_text(statement, i + 1, stringView.data(), (int) stringView.length(), SQLITE_STATIC);
            if (i == 0) {
                returnId = std::string(stringView);
            }
        } else if (type == ondemand::json_type::number) {
            bindResult = sqlite3_bind_double(statement, i + 1, (double) arg);
        } else if (type == ondemand::json_type::boolean) {
            bindResult = sqlite3_bind_int(statement, i + 1, (bool) arg);
        } else if (type == ondemand::json_type::null) {
            bindResult = sqlite3_bind_null(statement, i + 1);
        } else {
            throw jsi::JSError(rt, "Invalid argument type for query - only strings, numbers, booleans and null are allowed");
        }

        i++;

        if (bindResult != SQLITE_OK) {
            sqlite3_reset(statement);
            throw dbError("Failed to bind an argument for query");
        }
    }

    if (argsCount != i) {
        sqlite3_reset(statement);
        throw jsi::JSError(rt, "Number of args passed to query doesn't match number of arg placeholders");
    }

    return returnId;
}

SqliteStatement Database::executeQuery(std::string sql, jsi::Array &arguments) {
    auto statement = prepareQuery(sql);
    bindArgs(statement.stmt, arguments);
    return statement;
}

void Database::executeUpdate(sqlite3_stmt *statement) {
    int stepResult = sqlite3_step(statement);

    if (stepResult != SQLITE_DONE) {
        throw dbError("Failed to execute db update");
    }
}

void Database::executeUpdate(std::string sql, jsi::Array &args) {
    auto statement = prepareQuery(sql);
    bindArgs(statement.stmt, args);
    executeUpdate(statement.stmt);
}

void Database::executeUpdate(std::string sql) {
    auto statement = prepareQuery(sql);
    executeUpdate(statement.stmt);
}

void Database::getRow(sqlite3_stmt *stmt) {
    int result = sqlite3_step(stmt);

    if (result != SQLITE_ROW) {
        throw dbError("Failed to get a row for query");
    }
}

bool Database::getNextRowOrTrue(sqlite3_stmt *stmt) {
    int result = sqlite3_step(stmt);

    if (result == SQLITE_DONE) {
        return true;
    } else if (result != SQLITE_ROW) {
        throw dbError("Failed to get a row for query");
    }

    return false;
}

void Database::executeMultiple(std::string sql) {
    auto &rt = getRt();
    char *errmsg = nullptr;
    int resultExec = sqlite3_exec(db_->sqlite, sql.c_str(), nullptr, nullptr, &errmsg);

    if (errmsg) {
        // sqlite docs are unclear on whether I need to use this argument or if I can just check result and use
        // sqlite3_errmsg if needed...
        std::string message(errmsg);
        sqlite3_free(errmsg);
        throw jsi::JSError(rt, message);
    }

    if (resultExec != SQLITE_OK) {
        throw dbError("Failed to execute statements");
    }
}

jsi::Object Database::resultDictionary(sqlite3_stmt *statement) {
    auto &rt = getRt();
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

jsi::Array Database::resultArray(sqlite3_stmt *statement) {
    auto &rt = getRt();
    int count = sqlite3_column_count(statement);
    jsi::Array result(rt, count);

    // TODO: DRY with resultDictionary (but check for performance regressions)
    for (int i = 0; i < count; i++) {
        auto type = sqlite3_column_type(statement, i);
        if (type == SQLITE_INTEGER) {
            sqlite3_int64 value = sqlite3_column_int64(statement, i);
            result.setValueAtIndex(rt, i, jsi::Value((double)value));
        } else if (type == SQLITE_FLOAT) {
            double value = sqlite3_column_double(statement, i);
            result.setValueAtIndex(rt, i, jsi::Value(value));
        } else if (type == SQLITE_TEXT) {
            const char *text = (const char *)sqlite3_column_text(statement, i);
            if (text) {
                result.setValueAtIndex(rt, i, jsi::String::createFromUtf8(rt, text));
            } else {
                result.setValueAtIndex(rt, i, jsi::Value::null());
            }
        } else if (type == SQLITE_NULL) {
            result.setValueAtIndex(rt, i, jsi::Value::null());
        } else {
            throw jsi::JSError(rt, "Unable to fetch record from database - unknown column type (WatermelonDB does not support blobs or custom sqlite types");
        }
    }

    return result;
}

jsi::Array Database::resultColumns(sqlite3_stmt *statement) {
    auto &rt = getRt();
    int count = sqlite3_column_count(statement);
    jsi::Array columns(rt, count);

    for (int i = 0; i < count; i++) {
        const char *column = sqlite3_column_name(statement, i);
        assert(column);
        columns.setValueAtIndex(rt, i, jsi::String::createFromUtf8(rt, column));
    }

    return columns;
}

void Database::beginTransaction() {
    // NOTE: using exclusive transaction, because that's what FMDB does
    // In theory, `deferred` seems better, since it's less likely to get locked
    // OTOH, we don't really do multithreaded access, and when we *do*, we'd either
    // use a serial queue (easiest) or have to do a lot more work to avoid locking
    executeUpdate("begin exclusive transaction");
}

void Database::commit() {
    executeUpdate("commit transaction");
}

void Database::rollback() {
    // TODO: Use RAII to rollback automatically!
    consoleError("WatermelonDB sqlite transaction is being rolled back! This is BAD - it means that there's either a "
                 "WatermelonDB bug or a user issue (e.g. no empty disk space) that Watermelon may be unable to recover "
                 "from safely... Do investigate!");
    // NOTE: On some errors (like IO, memory errors), the transaction may be rolled back automatically
    // Attempting to roll it back ourselves would result in another error, which would hide the original error
    // According to https://sqlite.org/c3ref/get_autocommit.html , checking autocommit status is the only
    // way to find out whether that's the case. This feels wrong...
    // https://sqlite.org/lang_transaction.html recommends that we roll back anyway, since an error is
    // harmless.
    try {
        executeUpdate("rollback transaction");
    } catch (const std::exception &ex) {
        std::string errorMessage = "Error while attempting to roll back transaction, probably harmless: ";
        errorMessage += ex.what();
        consoleError(errorMessage);
    }
}

int Database::getUserVersion() {
    auto &rt = getRt();
    auto args = jsi::Array::createWithElements(rt);
    auto statement = executeQuery("pragma user_version", args);
    getRow(statement.stmt);

    assert(sqlite3_data_count(statement.stmt) == 1);

    int version = sqlite3_column_int(statement.stmt, 0);
    return version;
}

void Database::setUserVersion(int newVersion) {
    // NOTE: placeholders don't work, and ints are safe
    std::string sql = "pragma user_version = " + std::to_string(newVersion);
    executeUpdate(sql);
}

}
