#include "Database.h"
#include "DatabasePlatform.h"
#include "JSLockPerfHack.h"
#include "simdjson.h"
#include "vendor/rapidjson/writer.h"
#include "vendor/rapidjson/stringbuffer.h"

namespace watermelondb {

using platform::consoleError;
using platform::consoleLog;

Database::Database(jsi::Runtime *runtime, std::string path) : runtime_(runtime) {
    db_ = std::make_unique<SqliteDb>(path);
}

jsi::Runtime &Database::getRt() {
    return *runtime_;
}

jsi::JSError Database::dbError(std::string description) {
    // TODO: In serialized threading mode, those may be incorrect - probably smarter to pass result codes around?
    auto sqliteMessage = std::string(sqlite3_errmsg(db_->sqlite));
    auto code = sqlite3_extended_errcode(db_->sqlite);
    auto message = description + " - sqlite error " + std::to_string(code) + " (" + sqliteMessage + ")";
    // Note: logging to console in case another exception is thrown so that the original error isn't lost
    consoleError(message);

    auto &rt = getRt();
    return jsi::JSError(rt, message);
}

Database::~Database() {
    for (auto const &cachedStatement : cachedStatements_) {
        sqlite3_stmt *statement = cachedStatement.second;
        sqlite3_finalize(statement);
    }
    cachedStatements_ = {};
}

std::string cacheKey(std::string tableName, std::string recordId) {
    return tableName + "$" + recordId; // NOTE: safe as long as table names cannot contain $ sign
}

bool Database::isCached(std::string cacheKey) {
    return cachedRecords_.find(cacheKey) != cachedRecords_.end();
}
void Database::markAsCached(std::string cacheKey) {
    cachedRecords_.insert(cacheKey);
}
void Database::removeFromCache(std::string cacheKey) {
    cachedRecords_.erase(cacheKey);
}

sqlite3_stmt* Database::prepareQuery(std::string sql) {
    sqlite3_stmt *statement = cachedStatements_[sql];

    if (statement == nullptr) {
        int resultPrepare = sqlite3_prepare_v2(db_->sqlite, sql.c_str(), -1, &statement, nullptr);

        if (resultPrepare != SQLITE_OK) {
            sqlite3_finalize(statement);
            throw dbError("Failed to prepare query statement");
        }

        cachedStatements_[sql] = statement;
    } else {
        // in theory, this shouldn't be necessary, since statements ought to be reset *after* use, not before use
        // but still this might prevent some crashes if this is not done right
        // TODO: Remove this later - should not be necessary, and it wastes time
        sqlite3_reset(statement);
    }
    assert(statement != nullptr);
    return statement;
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
            throw dbError("Failed to bind an argument for query");
        }
    }
}
 
SqliteStatement Database::executeQuery(std::string sql, jsi::Array &arguments) {
    auto statement = prepareQuery(sql);
    bindArgs(statement, arguments);

    // TODO: We may move this initialization earlier to avoid having to care about sqlite3_reset, but I think we'll
    // have to implement a move constructor for it to be correct
    return SqliteStatement(statement);
}

std::string Database::bindArgs(sqlite3_stmt *statement, simdjson::ondemand::array &arguments) {
    using namespace simdjson;
    auto &rt = getRt();
    
    int argsCount = sqlite3_bind_parameter_count(statement);
    
    std::string returnId = "";
    
    int arg_i = 0;
    for (auto arg : arguments) {
        int bindResult;
        switch (arg.type()) {
            case ondemand::json_type::string: {
                std::string_view str_view = arg;
//                std::string str = std::string(str_view);
                // TODO: Check SQLITE_STATIC
                // TODO: null termination?
                bindResult = sqlite3_bind_text(statement, arg_i + 1, str_view.data(), (int) str_view.length(), SQLITE_STATIC);
//                bindResult = sqlite3_bind_text(statement, arg_i + 1, str.c_str(), -1, SQLITE_TRANSIENT);
                if (arg_i == 0) {
                    returnId = std::string(str_view);
                }
                break;
            }
            case ondemand::json_type::number: {
                double num = arg;
                bindResult = sqlite3_bind_double(statement, arg_i + 1, num);
                break;
            }
            case ondemand::json_type::boolean: {
                bool val = arg;
                bindResult = sqlite3_bind_int(statement, arg_i + 1, val);
                break;
            }
            case ondemand::json_type::null: {
                bindResult = sqlite3_bind_null(statement, arg_i + 1);
                break;
            }
            case ondemand::json_type::array: {
                throw jsi::JSError(rt, "Invalid argument type (array) for query");
                break;
            }
            case ondemand::json_type::object: {
                throw jsi::JSError(rt, "Invalid argument type (object) for query");
                break;
            }
        }
        
        if (bindResult != SQLITE_OK) {
            sqlite3_reset(statement);
            throw dbError("Failed to bind an argument for query");
        }
        
        arg_i++;
    }
    
    if (argsCount != arg_i) {
        sqlite3_reset(statement);
        throw jsi::JSError(rt, "Number of args passed to query doesn't match number of arg placeholders");
    }
    
    return returnId;
}

std::pair<sqlite3_stmt *, std::string> Database::executeQuery(std::string sql, simdjson::ondemand::array &arguments) {
    auto statement = prepareQuery(sql);
    auto returnId = bindArgs(statement, arguments);

    // TODO: We may move this initialization earlier to avoid having to care about sqlite3_reset, but I think we'll
    // have to implement a move constructor for it to be correct
    return std::make_pair(statement, returnId);
}

void Database::executeUpdate(sqlite3_stmt *statement) {
    int stepResult = sqlite3_step(statement);

    if (stepResult != SQLITE_DONE) {
        throw dbError("Failed to execute db update");
    }
}

void Database::executeUpdate(std::string sql, jsi::Array &args) {
    auto statement = executeQuery(sql, args);
    executeUpdate(statement.stmt);
}

std::string Database::executeUpdate(std::string sql, simdjson::ondemand::array &args) {
    auto [stmt, id] = executeQuery(sql, args);
    SqliteStatement statement(stmt);
    int stepResult = sqlite3_step(stmt);

    if (stepResult != SQLITE_DONE) {
        throw dbError("Failed to execute db update");
    }
    
    return id;
}

void Database::executeUpdate(std::string sql) {
    auto &rt = getRt();
    auto args = jsi::Array::createWithElements(rt);
    executeUpdate(sql, args);
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

        switch (sqlite3_column_type(statement, i)) {
        case SQLITE_INTEGER: {
            sqlite3_int64 value = sqlite3_column_int64(statement, i);
            dictionary.setProperty(rt, column, jsi::Value((double)value));
            break;
        }
        case SQLITE_FLOAT: {
            double value = sqlite3_column_double(statement, i);
            dictionary.setProperty(rt, column, jsi::Value(value));
            break;
        }
        case SQLITE_TEXT: {
            const char *text = (const char *)sqlite3_column_text(statement, i);

            if (text) {
                dictionary.setProperty(rt, column, jsi::String::createFromUtf8(rt, text));
            } else {
                dictionary.setProperty(rt, column, jsi::Value::null());
            }

            break;
        }
        case SQLITE_NULL: {
            dictionary.setProperty(rt, column, jsi::Value::null());
            break;
        }
        case SQLITE_BLOB: {
            throw jsi::JSError(rt, "Unable to fetch record from database because WatermelonDB does not support blobs");
        }
        default: {
            throw jsi::JSError(rt, "Unable to fetch record from database - unknown column type (WatermelonDB does not "
                                   "support custom sqlite types currently)");
        }
        }
    }

    return dictionary; // TODO: Make sure this value is moved, not copied
}

void Database::resultJSON(sqlite3_stmt *statement, rapidjson::Writer<rapidjson::StringBuffer> &json) {
    auto &rt = getRt();
    json.StartObject();

    for (int i = 0, len = sqlite3_column_count(statement); i < len; i++) {
        const char *column = sqlite3_column_name(statement, i);
        assert(column);
        
        json.Key(column);

        switch (sqlite3_column_type(statement, i)) {
        case SQLITE_INTEGER: {
            sqlite3_int64 value = sqlite3_column_int64(statement, i);
            json.Int64(value);
            break;
        }
        case SQLITE_FLOAT: {
            double value = sqlite3_column_double(statement, i);
            json.Double(value);
            break;
        }
        case SQLITE_TEXT: {
            const char *text = (const char *)sqlite3_column_text(statement, i);

            if (text) {
                json.String(text);
            } else {
                json.Null();
            }
            break;
        }
        case SQLITE_NULL: {
            json.Null();
            break;
        }
        case SQLITE_BLOB: {
            throw jsi::JSError(rt, "Unable to fetch record from database because WatermelonDB does not support blobs");
        }
        default: {
            throw jsi::JSError(rt, "Unable to fetch record from database - unknown column type (WatermelonDB does not "
                                   "support custom sqlite types currently)");
        }
        }
    }
    
    json.EndObject();
}

void Database::resultArrayJSON(sqlite3_stmt *statement, rapidjson::Writer<rapidjson::StringBuffer> &json) {
    auto &rt = getRt();
    int count = sqlite3_column_count(statement);
    
    json.StartArray();

    for (int i = 0; i < count; i++) {
        switch (sqlite3_column_type(statement, i)) {
        case SQLITE_INTEGER: {
            sqlite3_int64 value = sqlite3_column_int64(statement, i);
            json.Int64(value);
            break;
        }
        case SQLITE_FLOAT: {
            double value = sqlite3_column_double(statement, i);
            json.Double(value);
            break;
        }
        case SQLITE_TEXT: {
            const char *text = (const char *)sqlite3_column_text(statement, i);

            if (text) {
                json.String(text);
            } else {
                json.Null();
            }
            break;
        }
        case SQLITE_NULL: {
            json.Null();
            break;
        }
        case SQLITE_BLOB: {
            throw jsi::JSError(rt, "Unable to fetch record from database because WatermelonDB does not support blobs");
        }
        default: {
            throw jsi::JSError(rt, "Unable to fetch record from database - unknown column type (WatermelonDB does not "
                                   "support custom sqlite types currently)");
        }
        }
    }
    
    json.EndArray();
}

jsi::Array Database::resultArray(sqlite3_stmt *statement) {
    auto &rt = getRt();
    int count = sqlite3_column_count(statement);
    jsi::Array result(rt, count);

    for (int i = 0; i < count; i++) {
        switch (sqlite3_column_type(statement, i)) {
        case SQLITE_INTEGER: {
            sqlite3_int64 value = sqlite3_column_int64(statement, i);
            result.setValueAtIndex(rt, i, jsi::Value((double)value));
            break;
        }
        case SQLITE_FLOAT: {
            double value = sqlite3_column_double(statement, i);
            result.setValueAtIndex(rt, i, jsi::Value(value));
            break;
        }
        case SQLITE_TEXT: {
            const char *text = (const char *)sqlite3_column_text(statement, i);

            if (text) {
                result.setValueAtIndex(rt, i, jsi::String::createFromUtf8(rt, text));
            } else {
                result.setValueAtIndex(rt, i, jsi::Value::null());
            }

            break;
        }
        case SQLITE_NULL: {
            result.setValueAtIndex(rt, i, jsi::Value::null());
            break;
        }
        case SQLITE_BLOB: {
            throw jsi::JSError(rt, "Unable to fetch record from database because WatermelonDB does not support blobs");
        }
        default: {
            throw jsi::JSError(rt, "Unable to fetch record from database - unknown column type (WatermelonDB does not "
                                   "support custom sqlite types currently)");
        }
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

void Database::resultColumnsJSON(sqlite3_stmt *statement, rapidjson::Writer<rapidjson::StringBuffer> &json) {
    int count = sqlite3_column_count(statement);
    
    json.StartArray();

    for (int i = 0; i < count; i++) {
        const char *column = sqlite3_column_name(statement, i);
        assert(column);
        json.String(column);
    }

    json.EndArray();
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

    int stepResult = sqlite3_step(statement.stmt);

    if (stepResult != SQLITE_ROW) {
        throw dbError("Failed to obtain database user_version");
    }

    assert(sqlite3_data_count(statement.stmt) == 1);

    int version = sqlite3_column_int(statement.stmt, 0);
    return version;
}

void Database::setUserVersion(int newVersion) {
    // NOTE: placeholders don't work, and ints are safe
    std::string sql = "pragma user_version = " + std::to_string(newVersion);
    executeUpdate(sql);
}

jsi::Value Database::find(jsi::String &tableName, jsi::String &id) {
    auto &rt = getRt();
    if (isCached(cacheKey(tableName.utf8(rt), id.utf8(rt)))) {
        return std::move(id);
    }

    auto args = jsi::Array::createWithElements(rt, id);
    auto statement = executeQuery("select * from `" + tableName.utf8(rt) + "` where id == ? limit 1", args);

    int stepResult = sqlite3_step(statement.stmt);

    if (stepResult == SQLITE_DONE) {
        return jsi::Value::null();
    } else if (stepResult != SQLITE_ROW) {
        throw dbError("Failed to find a record in the database");
    }

    auto record = resultDictionary(statement.stmt);

    markAsCached(cacheKey(tableName.utf8(rt), id.utf8(rt)));

    return record;
}

jsi::Value Database::query(jsi::String &tableName, jsi::String &sql, jsi::Array &arguments) {
    auto &rt = getRt();
    auto statement = executeQuery(sql.utf8(rt), arguments);

    // FIXME: Adding directly to a jsi::Array should be more efficient, but Hermes does not support
    // automatically resizing an Array by setting new values to it
    std::vector<jsi::Value> records = {};

    while (true) {
        int stepResult = sqlite3_step(statement.stmt);

        if (stepResult == SQLITE_DONE) {
            break;
        } else if (stepResult != SQLITE_ROW) {
            throw dbError("Failed to query the database");
        }

        assert(std::string(sqlite3_column_name(statement.stmt, 0)) == "id");

        const char *id = (const char *)sqlite3_column_text(statement.stmt, 0);
        if (!id) {
            throw jsi::JSError(rt, "Failed to get ID of a record");
        }

        if (isCached(cacheKey(tableName.utf8(rt), std::string(id)))) {
            jsi::String jsiId = jsi::String::createFromAscii(rt, id);
            records.push_back(std::move(jsiId));
        } else {
            markAsCached(cacheKey(tableName.utf8(rt), std::string(id)));
            jsi::Object record = resultDictionary(statement.stmt);
            records.push_back(std::move(record));
        }
    }

    jsi::Array jsiRecords(rt, records.size());
    size_t i = 0;
    for (auto const &record : records) {
        jsiRecords.setValueAtIndex(rt, i, record);
        i++;
    }

    return jsiRecords;
}

jsi::Value Database::queryAsArray(jsi::String &tableName, jsi::String &sql, jsi::Array &arguments) {
    auto &rt = getRt();
    auto statement = executeQuery(sql.utf8(rt), arguments);

    // FIXME: Adding directly to a jsi::Array should be more efficient, but Hermes does not support
    // automatically resizing an Array by setting new values to it
    std::vector<jsi::Value> records = {};

    while (true) {
        int stepResult = sqlite3_step(statement.stmt);

        if (stepResult == SQLITE_DONE) {
            break;
        } else if (stepResult != SQLITE_ROW) {
            throw dbError("Failed to query the database");
        }

        assert(std::string(sqlite3_column_name(statement.stmt, 0)) == "id");

        const char *id = (const char *)sqlite3_column_text(statement.stmt, 0);
        if (!id) {
            throw jsi::JSError(rt, "Failed to get ID of a record");
        }
        
        if (records.size() == 0) {
            jsi::Array columns = resultColumns(statement.stmt);
            records.push_back(std::move(columns));
        }

        if (isCached(cacheKey(tableName.utf8(rt), std::string(id)))) {
            jsi::String jsiId = jsi::String::createFromAscii(rt, id);
            records.push_back(std::move(jsiId));
        } else {
            markAsCached(cacheKey(tableName.utf8(rt), std::string(id)));
            jsi::Array record = resultArray(statement.stmt);
            records.push_back(std::move(record));
        }
    }

    jsi::Array jsiRecords(rt, records.size());
    size_t i = 0;
    for (auto const &record : records) {
        jsiRecords.setValueAtIndex(rt, i, record);
        i++;
    }

    return jsiRecords;
}

jsi::String Database::queryAsArrayJSON(jsi::String &tableName, jsi::String &sql, jsi::Array &arguments) {
    using namespace rapidjson;
    auto &rt = getRt();
    auto statement = executeQuery(sql.utf8(rt), arguments);
    
    StringBuffer buffer;
    Writer<StringBuffer> json(buffer);
    
    json.StartArray();

    int i = 0;
    while (true) {
        int stepResult = sqlite3_step(statement.stmt);

        if (stepResult == SQLITE_DONE) {
            break;
        } else if (stepResult != SQLITE_ROW) {
            throw dbError("Failed to query the database");
        }

        assert(std::string(sqlite3_column_name(statement.stmt, 0)) == "id");

        const char *id = (const char *)sqlite3_column_text(statement.stmt, 0);
        if (!id) {
            throw jsi::JSError(rt, "Failed to get ID of a record");
        }
        
        if (i == 0) {
            resultColumnsJSON(statement.stmt, json);
        }

        if (isCached(cacheKey(tableName.utf8(rt), std::string(id)))) {
            json.String(id);
        } else {
            markAsCached(cacheKey(tableName.utf8(rt), std::string(id)));
            resultArrayJSON(statement.stmt, json);
        }
        
        i++;
    }
    
    json.EndArray();
    
    const uint8_t* str = reinterpret_cast<const uint8_t *>(buffer.GetString());
    return jsi::String::createFromUtf8(rt, str, buffer.GetLength());
}

jsi::String Database::queryJSON(jsi::String &tableName, jsi::String &sql, jsi::Array &arguments) {
    using namespace rapidjson;
    auto &rt = getRt();
    auto statement = executeQuery(sql.utf8(rt), arguments);
    
    StringBuffer buffer;
    Writer<StringBuffer> json(buffer);
    
    json.StartArray();

    while (true) {
        int stepResult = sqlite3_step(statement.stmt);

        if (stepResult == SQLITE_DONE) {
            break;
        } else if (stepResult != SQLITE_ROW) {
            throw dbError("Failed to query the database");
        }

        assert(std::string(sqlite3_column_name(statement.stmt, 0)) == "id");

        const char *id = (const char *)sqlite3_column_text(statement.stmt, 0);
        if (!id) {
            throw jsi::JSError(rt, "Failed to get ID of a record");
        }

        if (isCached(cacheKey(tableName.utf8(rt), std::string(id)))) {
            json.String(id);
        } else {
            markAsCached(cacheKey(tableName.utf8(rt), std::string(id)));
            resultJSON(statement.stmt, json);
        }
    }
    
    json.EndArray();
    
    const uint8_t* str = reinterpret_cast<const uint8_t *>(buffer.GetString());
    return jsi::String::createFromUtf8(rt, str, buffer.GetLength());
}

jsi::Array Database::queryIds(jsi::String &sql, jsi::Array &arguments) {
    auto &rt = getRt();
    auto statement = executeQuery(sql.utf8(rt), arguments);

    // FIXME: Adding directly to a jsi::Array should be more efficient, but Hermes does not support
    // automatically resizing an Array by setting new values to it
    std::vector<jsi::String> ids = {};

    while (true) {
        int stepResult = sqlite3_step(statement.stmt);

        if (stepResult == SQLITE_DONE) {
            break;
        } else if (stepResult != SQLITE_ROW) {
            throw dbError("Failed to query the database");
        }

        assert(std::string(sqlite3_column_name(statement.stmt, 0)) == "id");

        const char *idText = (const char *)sqlite3_column_text(statement.stmt, 0);
        if (!idText) {
            throw jsi::JSError(rt, "Failed to get ID of a record");
        }

        jsi::String id = jsi::String::createFromAscii(rt, idText);
        ids.push_back(std::move(id));
    }

    jsi::Array jsiIds(rt, ids.size());
    size_t i = 0;
    for (auto const &id : ids) {
        jsiIds.setValueAtIndex(rt, i, id);
        i++;
    }

    return jsiIds;
}

jsi::Array Database::unsafeQueryRaw(jsi::String &sql, jsi::Array &arguments) {
    auto &rt = getRt();
    auto statement = executeQuery(sql.utf8(rt), arguments);

    // FIXME: Adding directly to a jsi::Array should be more efficient, but Hermes does not support
    // automatically resizing an Array by setting new values to it
    std::vector<jsi::Value> raws = {};

    while (true) {
        int stepResult = sqlite3_step(statement.stmt);

        if (stepResult == SQLITE_DONE) {
            break;
        } else if (stepResult != SQLITE_ROW) {
            throw dbError("Failed to query the database");
        }

        jsi::Object raw = resultDictionary(statement.stmt);
        raws.push_back(std::move(raw));
    }

    jsi::Array jsiRaws(rt, raws.size());
    size_t i = 0;
    for (auto const &raw : raws) {
        jsiRaws.setValueAtIndex(rt, i, raw);
        i++;
    }

    return jsiRaws;
}

jsi::Value Database::count(jsi::String &sql, jsi::Array &arguments) {
    auto &rt = getRt();
    auto statement = executeQuery(sql.utf8(rt), arguments);

    int stepResult = sqlite3_step(statement.stmt);

    if (stepResult != SQLITE_ROW) {
        throw dbError("Failed to query a count");
    }

    assert(sqlite3_data_count(statement.stmt) == 1);
    int count = sqlite3_column_int(statement.stmt, 0);

    return jsi::Value(count);
}

void Database::batch(jsi::Array &operations) {
    auto &rt = getRt();
    beginTransaction();

    std::vector<std::string> addedIds = {};
    std::vector<std::string> removedIds = {};

    try {
        size_t operationsCount = operations.length(rt);
        for (size_t i = 0; i < operationsCount; i++) {
            jsi::Array operation = operations.getValueAtIndex(rt, i).getObject(rt).getArray(rt);

            auto cacheBehavior = operation.getValueAtIndex(rt, 0).getNumber();
            auto table = cacheBehavior != 0 ? operation.getValueAtIndex(rt, 1).getString(rt).utf8(rt) : "";
            auto sql = operation.getValueAtIndex(rt, 2).getString(rt).utf8(rt);

            jsi::Array argsBatches = operation.getValueAtIndex(rt, 3).getObject(rt).getArray(rt);
            size_t argsBatchesCount = argsBatches.length(rt);
            for (size_t j = 0; j < argsBatchesCount; j++) {
                jsi::Array args = argsBatches.getValueAtIndex(rt, j).getObject(rt).getArray(rt);
                executeUpdate(sql, args);
                if (cacheBehavior != 0) {
                    auto id = args.getValueAtIndex(rt, 0).getString(rt).utf8(rt);
                    if (cacheBehavior == 1) {
                        addedIds.push_back(cacheKey(table, id));
                    } else if (cacheBehavior == -1) {
                        removedIds.push_back(cacheKey(table, id));
                    }
                }
            }

        }
        commit();
    } catch (const std::exception &ex) {
        rollback();
        throw;
    }

    for (auto const &key : addedIds) {
        markAsCached(key);
    }

    for (auto const &key : removedIds) {
        removeFromCache(key);
    }
}

void Database::batchJSON(jsi::String &&jsiJson) {
    using namespace simdjson;
    
    auto &rt = getRt();
    beginTransaction();

    std::vector<std::string> addedIds = {};
    std::vector<std::string> removedIds = {};

    try {
        ondemand::parser parser;
        auto json = padded_string(jsiJson.utf8(rt));
        ondemand::document doc = parser.iterate(json);
        
        for (ondemand::array operation : doc) {
            int64_t cacheBehavior = 0;
            std::string table;
            std::string sql;
            ondemand::array argsBatches;
            size_t i = 0;
            for (auto field : operation) {
                switch (i) {
                    case 0:
                        cacheBehavior = field;
                        break;
                    case 1: {
                        if (cacheBehavior != 0) {
                            std::string_view str = field;
                            table = str;
                        }
                        break;
                    }
                    case 2: {
                        std::string_view str = field;
                        sql = str;
                        break;
                    }
                    case 3:
                        argsBatches = field;
                        auto stmt = prepareQuery(sql);
                        SqliteStatement statement(stmt);
                        
                        for (ondemand::array args : argsBatches) {
                            auto id = bindArgs(stmt, args);
                            executeUpdate(stmt);
                            sqlite3_reset(stmt);
                            if (cacheBehavior != 0) {
                                if (cacheBehavior == 1) {
                                    addedIds.push_back(cacheKey(table, id));
                                } else if (cacheBehavior == -1) {
                                    removedIds.push_back(cacheKey(table, id));
                                }
                            }
                        }
                        break;
                }
                i++;
            }
        }
        
        commit();
    } catch (const std::exception &ex) {
        rollback();
        throw;
    }

    for (auto const &key : addedIds) {
        markAsCached(key);
    }

    for (auto const &key : removedIds) {
        removeFromCache(key);
    }
}

enum ColumnType { string, number, boolean };
 struct ColumnSchema {
     std::string name;
     ColumnType type;
 };

 ColumnType columnTypeFromStr(std::string &type) {
     if (type == "string") {
         return ColumnType::string;
     } else if (type == "number") {
         return ColumnType::number;
     } else if (type == "boolean") {
         return ColumnType::boolean;
     } else {
         throw std::invalid_argument("invalid column type in schema");
     }
 }

 using TableSchema = std::vector<ColumnSchema>;
 TableSchema decodeTableSchema(jsi::Runtime &rt, jsi::Object &schema) {
     auto columnArr = schema.getProperty(rt, "columnArray").getObject(rt).getArray(rt);
     std::vector<ColumnSchema> columns = {};
     for (size_t i = 0, len = columnArr.size(rt); i < len; i++) {
         auto columnObj = columnArr.getValueAtIndex(rt, i).getObject(rt);
         auto name = columnObj.getProperty(rt, "name").getString(rt).utf8(rt); // TODO: reuse the same JS string
         auto typeStr = columnObj.getProperty(rt, "type").getString(rt).utf8(rt);
         ColumnType type = columnTypeFromStr(typeStr);
         ColumnSchema column = { name, type };
         columns.push_back(column);
     }
     return columns;
 }

 std::string insertSqlFor(jsi::Runtime &rt, std::string tableName, TableSchema columns) {
     std::string sql = "insert into `" + tableName + "` (`id`, `_status";
     for (auto const &column : columns) {
         sql += "`, `" + column.name;
     }
     sql += "`) values (?, ?";
     for (size_t i = 0, len = columns.size(); i < len; i++) {
         sql += ", ?";
     }
     sql += ")";
     return sql;
 }

void Database::unsafeLoadFromSyncJSON(std::string jsonStr, jsi::Object &schema) {
    using namespace simdjson;
    auto &rt = getRt();
    beginTransaction();

    try {
        auto tableSchemas = schema.getProperty(rt, "tables").getObject(rt);
        
        ondemand::parser parser;
        auto json = padded_string(jsonStr);
        ondemand::document doc = parser.iterate(json);
        
        ondemand::object changeSet = doc["changeSet"];
        
        for (auto changeSetField : changeSet) {
            std::string_view tableNameView = changeSetField.unescaped_key();
            auto tableName = std::string(tableNameView);
            ondemand::object tableChangeSet = changeSetField.value();
            
            for (auto tableChangeSetField : tableChangeSet) {
                std::string_view tableChangeSetKey = tableChangeSetField.unescaped_key();
                ondemand::array records = tableChangeSetField.value();
                
                if (tableChangeSetKey == "created" || tableChangeSetKey == "deleted") {
                    int i = 0;
                    for (auto _value : records) {
                        i++;
                    }
                    if (i > 0) {
                        throw jsi::JSError(rt, "bad created/deleted");
                    }
                    continue;
                } else if (tableChangeSetKey != "updated") {
                    throw jsi::JSError(rt, "bad changeset field");
                }
                
                auto tableSchemaObj = tableSchemas.getProperty(rt, jsi::String::createFromUtf8(rt, tableName)).getObject(rt);
                auto tableSchema = decodeTableSchema(rt, tableSchemaObj);
                
                sqlite3_stmt *stmt = prepareQuery(insertSqlFor(rt, tableName, tableSchema));
                SqliteStatement statement(stmt);
                
                for (ondemand::object record : records) {
                    std::string_view idView = record["id"];
                    sqlite3_bind_text(stmt, 1, idView.data(), (int) idView.length(), SQLITE_STATIC);
                    sqlite3_bind_text(stmt, 2, "synced", -1, SQLITE_STATIC);

                    int argumentsIdx = 3;
                    for (auto const &column : tableSchema) {
                        ondemand::value value;
                        ondemand::json_type type;
                        auto error = record[column.name].get(value);
                        if (error) {
                            type = ondemand::json_type::null;
                        } else {
                            type = value.type();
                        }
                        
                        if (type == ondemand::json_type::null) {
                            sqlite3_bind_null(stmt, argumentsIdx);
                        } else if (column.type == ColumnType::string) {
                            std::string_view stringView = value;
                            sqlite3_bind_text(stmt, argumentsIdx, stringView.data(), (int) stringView.length(), SQLITE_STATIC);
                        } else if (column.type == ColumnType::boolean) {
                            sqlite3_bind_int(stmt, argumentsIdx, type == ondemand::json_type::boolean ? (bool) value : 0);
                        } else if (column.type == ColumnType::number) {
                            sqlite3_bind_double(stmt, argumentsIdx, (double) value);
                        } else {
                            throw jsi::JSError(rt, "Invalid argument type (unknown) for query");
                        }

                        argumentsIdx += 1;
                    }

                    executeUpdate(stmt);
                    sqlite3_reset(stmt);
                }
            }
        }
        
        commit();
    } catch (const std::exception &ex) {
        rollback();
        throw;
    }
}

 void Database::unsafeLoadFromSync(jsi::Object &changeSet, jsi::Object &schema) {
     auto &rt = getRt();
     beginTransaction();

     try {
         auto tableSchemas = schema.getProperty(rt, "tables").getObject(rt);
         auto tableNames = changeSet.getPropertyNames(rt);

         auto idStr = jsi::String::createFromAscii(rt, "id");

         for (size_t i = 0, len = tableNames.size(rt); i < len; i++) {
             auto tableName = tableNames.getValueAtIndex(rt, i).getString(rt);
             auto tableChangeset = changeSet.getProperty(rt, tableName).getObject(rt);
             auto created = tableChangeset.getProperty(rt, "created").getObject(rt).getArray(rt);
             auto updated = tableChangeset.getProperty(rt, "updated").getObject(rt).getArray(rt);
             auto deleted = tableChangeset.getProperty(rt, "deleted").getObject(rt).getArray(rt);

             if (created.size(rt) > 0 || deleted.size(rt) > 0) {
                 throw jsi::JSError(rt, "bad created/deleted");
             }

             auto tableSchemaObj = tableSchemas.getProperty(rt, tableName).getObject(rt);
             auto tableSchema = decodeTableSchema(rt, tableSchemaObj);
             std::vector<jsi::String> columnNames = {};
             for (auto const &column : tableSchema) {
                 columnNames.push_back(jsi::String::createFromAscii(rt, column.name));
             }

             sqlite3_stmt *stmt = prepareQuery(insertSqlFor(rt, tableName.utf8(rt), tableSchema));
             SqliteStatement statement(stmt);

             for (size_t j = 0, j_len = updated.size(rt); j < j_len; j++) {
                 auto record = updated.getValueAtIndex(rt, j).getObject(rt);

                 sqlite3_bind_text(stmt, 1, record.getProperty(rt, idStr).getString(rt).utf8(rt).c_str(), -1, SQLITE_TRANSIENT);
                 sqlite3_bind_text(stmt, 2, "synced", -1, SQLITE_STATIC);

                 int argumentsIdx = 3;
                 for (auto const &column : tableSchema) {
                     auto value = record.getProperty(rt, columnNames[argumentsIdx - 3]);

                     if (value.isNull() || value.isUndefined()) {
                         sqlite3_bind_null(stmt, argumentsIdx);
                     } else if (column.type == ColumnType::string) {
                         sqlite3_bind_text(stmt, argumentsIdx, value.getString(rt).utf8(rt).c_str(), -1, SQLITE_TRANSIENT);
                     } else if (column.type == ColumnType::boolean) {
                         sqlite3_bind_int(stmt, argumentsIdx, value.isBool() ? value.getBool() : 0);
                     } else if (column.type == ColumnType::number) {
                         sqlite3_bind_double(stmt, argumentsIdx, value.getNumber());
                     } else {
                         throw jsi::JSError(rt, "Invalid argument type (unknown) for query");
                     }

                     argumentsIdx += 1;
                 }

                 executeUpdate(stmt);
                 sqlite3_reset(stmt);
             }
         }
         commit();
     } catch (const std::exception &ex) {
         rollback();
         throw;
     }
 }

void Database::unsafeResetDatabase(jsi::String &schema, int schemaVersion) {
    auto &rt = getRt();

    // TODO: in non-memory mode, just delete the DB files
    // NOTE: As of iOS 14, selecting tables from sqlite_master and deleting them does not work
    // They seem to be enabling "defensive" config. So we use another obscure method to clear the database
    // https://www.sqlite.org/c3ref/c_dbconfig_defensive.html#sqlitedbconfigresetdatabase

    if (sqlite3_db_config(db_->sqlite, SQLITE_DBCONFIG_RESET_DATABASE, 1, 0) != SQLITE_OK) {
        throw jsi::JSError(rt, "Failed to enable reset database mode");
    }
    // NOTE: We can't VACUUM in a transaction
    executeMultiple("vacuum");

    if (sqlite3_db_config(db_->sqlite, SQLITE_DBCONFIG_RESET_DATABASE, 0, 0) != SQLITE_OK) {
        throw jsi::JSError(rt, "Failed to disable reset database mode");
    }

    beginTransaction();
    try {
        cachedRecords_ = {};

        // Reinitialize schema
        executeMultiple(schema.utf8(rt));
        setUserVersion(schemaVersion);

        commit();
    } catch (const std::exception &ex) {
        rollback();
        throw;
    }
}

void Database::migrate(jsi::String &migrationSql, int fromVersion, int toVersion) {
    auto &rt = getRt();
    beginTransaction();
    try {
        assert(getUserVersion() == fromVersion && "Incompatible migration set");

        executeMultiple(migrationSql.utf8(rt));
        setUserVersion(toVersion);

        commit();
    } catch (const std::exception &ex) {
        rollback();
        throw;
    }
}

jsi::Value Database::getLocal(jsi::String &key) {
    auto &rt = getRt();
    auto args = jsi::Array::createWithElements(rt, key);
    auto statement = executeQuery("select value from local_storage where key = ?", args);

    int stepResult = sqlite3_step(statement.stmt);
    if (stepResult == SQLITE_DONE) {
        return jsi::Value::null();
    } else if (stepResult != SQLITE_ROW) {
        throw dbError("Failed to get a value from local storage");
    }

    assert(sqlite3_data_count(statement.stmt) == 1);
    const char *text = (const char *)sqlite3_column_text(statement.stmt, 0);

    if (!text) {
        return jsi::Value::null();
    }

    return jsi::String::createFromUtf8(rt, text);
}

} // namespace watermelondb
