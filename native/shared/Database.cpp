#include "Database.h"
#include "DatabasePlatform.h"
#include "JSLockPerfHack.h"
#include "simdjson.h"

namespace watermelondb {

using platform::consoleError;
using platform::consoleLog;

// TODO: Remove this after simdjson::to_string is released
// Adapted from https://github.com/simdjson/simdjson/blob/v0.9.5/doc/basics.md#documents-are-iterators
template <class T>
std::string to_json_string(T&& element) {
    using namespace simdjson;

    bool add_comma;
    std::stringstream json;

    switch (element.type()) {
    case ondemand::json_type::array:
        json << "[";
        add_comma = false;
        for (auto child : element.get_array()) {
            if (add_comma) {
                json << ",";
            }
            json << to_json_string(child.value());
            add_comma = true;
        }
        json << "]";
        break;
    case ondemand::json_type::object:
        json << "{";
        add_comma = false;
        for (auto field : element.get_object()) {
            if (add_comma) {
                json << ",";
            }
            json << "\"" << field.key() << "\": ";
            json << to_json_string(field.value());
            add_comma = true;
        }
        json << "}";
        break;
    case ondemand::json_type::number: {
        int64_t intValue;
        auto error = element.get(intValue);
        if (error) {
            json << std::to_string(element.get_double());
        } else {
            json << std::to_string(intValue);
        }
        break;
    }
    case ondemand::json_type::string:
        json << "\"" << element.get_raw_json_string() << "\"";
        break;
    case ondemand::json_type::boolean:
        json << (element.get_bool() ? "true" : "false");
        break;
    case ondemand::json_type::null:
        json << "null";
        break;
    }
    return json.str();
}

Database::Database(jsi::Runtime *runtime, std::string path) : runtime_(runtime) {
    db_ = std::make_unique<SqliteDb>(path);

    // FIXME: On Android, Watermelon often errors out on large batches with an IO error, because it
    // can't find a temp store... I tried setting sqlite3_temp_directory to /tmp/something, but that
    // didn't work. Setting temp_store to memory seems to fix the issue, but causes a significant
    // slowdown, at least on iOS (not confirmed on Android). Worth investigating if the slowdown is
    // also present on Android, and if so, investigate the root cause. Perhaps we need to set the temp
    // directory by interacting with JNI and finding a path within the app's sandbox?
    #ifdef ANDROID
    executeMultiple("pragma temp_store = memory;");
    #endif

    executeMultiple("pragma journal_mode = WAL;");
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
    bindArgs(statement, arguments);
    return SqliteStatement(statement);
}

void Database::executeUpdate(sqlite3_stmt *statement) {
    int stepResult = sqlite3_step(statement);

    if (stepResult != SQLITE_DONE) {
        throw dbError("Failed to execute db update");
    }
}

void Database::executeUpdate(std::string sql, jsi::Array &args) {
    auto stmt = prepareQuery(sql);
    bindArgs(stmt, args);
    SqliteStatement statement(stmt);
    executeUpdate(stmt);
}

void Database::executeUpdate(std::string sql) {
    auto stmt = prepareQuery(sql);
    SqliteStatement statement(stmt);
    executeUpdate(stmt);
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

jsi::Array Database::arrayFromStd(std::vector<jsi::Value> &vector) {
    // FIXME: Adding directly to a jsi::Array should be more efficient, but Hermes does not support
    // automatically resizing an Array by setting new values to it
    auto &rt = getRt();
    jsi::Array array(rt, vector.size());
    size_t i = 0;
    for (auto const &value : vector) {
        array.setValueAtIndex(rt, i, value);
        i++;
    }
    return array;
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

jsi::Value Database::find(jsi::String &tableName, jsi::String &id) {
    auto &rt = getRt();
    if (isCached(cacheKey(tableName.utf8(rt), id.utf8(rt)))) {
        return std::move(id);
    }

    auto args = jsi::Array::createWithElements(rt, id);
    auto statement = executeQuery("select * from `" + tableName.utf8(rt) + "` where id == ? limit 1", args);

    if (getNextRowOrTrue(statement.stmt)) {
        return jsi::Value::null();
    }

    auto record = resultDictionary(statement.stmt);

    markAsCached(cacheKey(tableName.utf8(rt), id.utf8(rt)));

    return record;
}

jsi::Value Database::query(jsi::String &tableName, jsi::String &sql, jsi::Array &arguments) {
    auto &rt = getRt();
    auto statement = executeQuery(sql.utf8(rt), arguments);

    std::vector<jsi::Value> records = {};

    while (true) {
        if (getNextRowOrTrue(statement.stmt)) {
            break;
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

    return arrayFromStd(records);
}

jsi::Value Database::queryAsArray(jsi::String &tableName, jsi::String &sql, jsi::Array &arguments) {
    auto &rt = getRt();
    auto statement = executeQuery(sql.utf8(rt), arguments);

    std::vector<jsi::Value> results = {};

    while (true) {
        if (getNextRowOrTrue(statement.stmt)) {
            break;
        }

        assert(std::string(sqlite3_column_name(statement.stmt, 0)) == "id");

        const char *id = (const char *)sqlite3_column_text(statement.stmt, 0);
        if (!id) {
            throw jsi::JSError(rt, "Failed to get ID of a record");
        }

        if (results.size() == 0) {
            jsi::Array columns = resultColumns(statement.stmt);
            results.push_back(std::move(columns));
        }

        if (isCached(cacheKey(tableName.utf8(rt), std::string(id)))) {
            jsi::String jsiId = jsi::String::createFromAscii(rt, id);
            results.push_back(std::move(jsiId));
        } else {
            markAsCached(cacheKey(tableName.utf8(rt), std::string(id)));
            jsi::Array record = resultArray(statement.stmt);
            results.push_back(std::move(record));
        }
    }

    return arrayFromStd(results);
}

jsi::Array Database::queryIds(jsi::String &sql, jsi::Array &arguments) {
    auto &rt = getRt();
    auto statement = executeQuery(sql.utf8(rt), arguments);

    std::vector<jsi::Value> ids = {};

    while (true) {
        if (getNextRowOrTrue(statement.stmt)) {
            break;
        }

        assert(std::string(sqlite3_column_name(statement.stmt, 0)) == "id");

        const char *idText = (const char *)sqlite3_column_text(statement.stmt, 0);
        if (!idText) {
            throw jsi::JSError(rt, "Failed to get ID of a record");
        }

        jsi::String id = jsi::String::createFromAscii(rt, idText);
        ids.push_back(std::move(id));
    }

    return arrayFromStd(ids);
}

jsi::Array Database::unsafeQueryRaw(jsi::String &sql, jsi::Array &arguments) {
    auto &rt = getRt();
    auto statement = executeQuery(sql.utf8(rt), arguments);

    std::vector<jsi::Value> raws = {};

    while (true) {
        if (getNextRowOrTrue(statement.stmt)) {
            break;
        }

        jsi::Object raw = resultDictionary(statement.stmt);
        raws.push_back(std::move(raw));
    }

    return arrayFromStd(raws);
}

jsi::Value Database::count(jsi::String &sql, jsi::Array &arguments) {
    auto &rt = getRt();
    auto statement = executeQuery(sql.utf8(rt), arguments);
    getRow(statement.stmt);

    assert(sqlite3_data_count(statement.stmt) == 1);
    int count = sqlite3_column_int(statement.stmt, 0);
    return jsi::Value(count);
}

// TODO: Remove non-json batch once we can tell that there's no serious perf regression
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

        // NOTE: simdjson::ondemand processes forwards-only, hence the weird field enumeration
        // We can't use subscript or backtrack.
        for (ondemand::array operation : doc) {
            int64_t cacheBehavior = 0;
            std::string table;
            std::string sql;
            size_t fieldIdx = 0;
            for (auto field : operation) {
                if (fieldIdx == 0) {
                    cacheBehavior = field;
                } else if (fieldIdx == 1) {
                    if (cacheBehavior != 0) {
                        table = (std::string_view) field;
                    }
                } else if (fieldIdx == 2) {
                    sql = (std::string_view) field;
                } else if (fieldIdx == 3) {
                    ondemand::array argsBatches = field;
                    auto stmt = prepareQuery(sql);
                    SqliteStatement statement(stmt);

                    for (ondemand::array args : argsBatches) {
                        // NOTE: We must capture the ID once first parsed
                        auto id = bindArgsAndReturnId(stmt, args);
                        executeUpdate(stmt);
                        sqlite3_reset(stmt);
                        if (cacheBehavior == 1) {
                            addedIds.push_back(cacheKey(table, id));
                        } else if (cacheBehavior == -1) {
                            removedIds.push_back(cacheKey(table, id));
                        }
                    }
                }
                fieldIdx++;
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
    int index;
    std::string name;
    ColumnType type;
    bool isOptional;
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

using TableSchemaArray = std::vector<ColumnSchema>;
using TableSchema = std::unordered_map<std::string, ColumnSchema>;
std::pair<TableSchemaArray, TableSchema> decodeTableSchema(jsi::Runtime &rt, jsi::Object schema) {
    auto columnArr = schema.getProperty(rt, "columnArray").getObject(rt).getArray(rt);

    TableSchemaArray columnsArray = {};
    TableSchema columns = {};

    for (size_t i = 0, len = columnArr.size(rt); i < len; i++) {
        auto columnObj = columnArr.getValueAtIndex(rt, i).getObject(rt);
        auto name = columnObj.getProperty(rt, "name").getString(rt).utf8(rt);
        auto typeStr = columnObj.getProperty(rt, "type").getString(rt).utf8(rt);
        ColumnType type = columnTypeFromStr(typeStr);
        auto isOptionalProp = columnObj.getProperty(rt, "isOptional");
        bool isOptional = isOptionalProp.isBool() ? isOptionalProp.getBool() : false;
        ColumnSchema column = { (int) i, name, type, isOptional };

        columnsArray.push_back(column);
        columns[name] = column;
    }

    return std::make_pair(columnsArray, columns);
}

std::string insertSqlFor(jsi::Runtime &rt, std::string tableName, TableSchemaArray columns) {
    std::string sql = "insert into `" + tableName + "` (`id`, `_status`, `_changed";
    for (auto const &column : columns) {
        sql += "`, `" + column.name;
    }
    sql += "`) values (?, 'synced', ''";
    for (size_t i = 0, len = columns.size(); i < len; i++) {
        sql += ", ?";
    }
    sql += ")";
    return sql;
}



jsi::Value Database::unsafeLoadFromSync(int jsonId, jsi::Object &schema, std::string preamble, std::string postamble) {
    using namespace simdjson;
    auto &rt = getRt();
    beginTransaction();

    try {
        executeMultiple(preamble);
        
        jsi::Object residualValues(rt);
        auto tableSchemas = schema.getProperty(rt, "tables").getObject(rt);

        ondemand::parser parser;
        auto json = padded_string(platform::getSyncJson(jsonId));
        ondemand::document doc = parser.iterate(json);

        // NOTE: simdjson::ondemand processes forwards-only, hence the weird field enumeration
        // We can't use subscript or backtrack.
        for (auto docField : (ondemand::object) doc) {
            std::string_view fieldNameView = docField.unescaped_key();

            if (fieldNameView != "changes") {
                // TODO: replace this with simdjson::to_string once available:
                // https://github.com/simdjson/simdjson/issues/1607
                ondemand::value value = docField.value();
                auto valueJson = to_json_string(value);
                residualValues.setProperty(rt,
                                           jsi::String::createFromUtf8(rt, (std::string) fieldNameView),
                                           jsi::String::createFromUtf8(rt, valueJson));
            } else {
                ondemand::object changeSet = docField.value();
                for (auto changeSetField : changeSet) {
                    auto tableName = (std::string) (std::string_view) changeSetField.unescaped_key();
                    ondemand::object tableChangeSet = changeSetField.value();

                    for (auto tableChangeSetField : tableChangeSet) {
                        std::string_view tableChangeSetKey = tableChangeSetField.unescaped_key();
                        ondemand::array records = tableChangeSetField.value();

                        if (tableChangeSetKey == "deleted") {
                            if (records.begin() != records.end()) {
                                throw jsi::JSError(rt, "expected deleted field to be empty");
                            }
                            continue;
                        } else if (tableChangeSetKey != "updated" && tableChangeSetKey != "created") {
                            throw jsi::JSError(rt, "bad changeset field");
                        }

                        auto tableSchemaJsi = tableSchemas.getProperty(rt, jsi::String::createFromUtf8(rt, tableName));
                        if (!tableSchemaJsi.isObject()) {
                            continue;
                        }
                        auto tableSchemas = decodeTableSchema(rt, tableSchemaJsi.getObject(rt));
                        auto tableSchemaArray = tableSchemas.first;
                        auto tableSchema = tableSchemas.second;

                        sqlite3_stmt *stmt = prepareQuery(insertSqlFor(rt, tableName, tableSchemaArray));
                        SqliteStatement statement(stmt);

                        for (ondemand::object record : records) {
                            // TODO: It would be much more natural to iterate over schema, and then get json's field
                            // and not the other way around, but simdjson doesn't allow us to do that right now
                            // I think 1.0 will allow subscripting objects even if it means backtracking
                            // So we need this stupid hack where we pre-bind null/0/false/'' to sanitize missing fields
                            for (auto column : tableSchemaArray) {
                                auto argumentsIdx = column.index + 2;
                                if (column.isOptional) {
                                    sqlite3_bind_null(stmt, argumentsIdx);
                                } else {
                                    if (column.type == ColumnType::string) {
                                        sqlite3_bind_text(stmt, argumentsIdx, "", -1, SQLITE_STATIC);
                                    } else if (column.type == ColumnType::boolean) {
                                        sqlite3_bind_int(stmt, argumentsIdx, 0);
                                    } else if (column.type == ColumnType::number) {
                                        sqlite3_bind_double(stmt, argumentsIdx, 0);
                                    } else {
                                        throw jsi::JSError(rt, "Unknown schema type");
                                    }
                                }
                            }
                            
                            for (auto valueField : record) {
                                auto key = (std::string) (std::string_view) valueField.unescaped_key();
                                auto value = valueField.value();

                                if (key == "id") {
                                    std::string_view idView = value;
                                    sqlite3_bind_text(stmt, 1, idView.data(), (int) idView.length(), SQLITE_STATIC);
                                    continue;
                                }

                                try {
                                    auto &column = tableSchema.at(key);
                                    ondemand::json_type type = value.type();
                                    auto argumentsIdx = column.index + 2;

                                    if (column.type == ColumnType::string && type == ondemand::json_type::string) {
                                        std::string_view stringView = value;
                                        sqlite3_bind_text(stmt, argumentsIdx, stringView.data(), (int) stringView.length(), SQLITE_STATIC);
                                    } else if (column.type == ColumnType::boolean) {
                                        if (type == ondemand::json_type::boolean) {
                                            sqlite3_bind_int(stmt, argumentsIdx, (bool) value);
                                        } else if (type == ondemand::json_type::number && ((double) value == 0 || (double) value == 1)) {
                                            sqlite3_bind_int(stmt, argumentsIdx, (bool) (double) value); // needed for compat with sanitizeRaw
                                        }
                                    } else if (column.type == ColumnType::number && type == ondemand::json_type::number) {
                                        sqlite3_bind_double(stmt, argumentsIdx, (double) value);
                                    }
                                } catch (const std::out_of_range &ex) {
                                    continue;
                                }
                            }

                            executeUpdate(stmt);
                            sqlite3_reset(stmt);
                        }
                    }
                }
            }
        }
        executeMultiple(postamble);
        commit();
        platform::deleteSyncJson(jsonId);
        return residualValues;
    } catch (const std::exception &ex) {
        platform::deleteSyncJson(jsonId);
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

    if (getNextRowOrTrue(statement.stmt)) {
        return jsi::Value::null();
    }

    assert(sqlite3_data_count(statement.stmt) == 1);
    const char *text = (const char *)sqlite3_column_text(statement.stmt, 0);

    if (!text) {
        return jsi::Value::null();
    }

    return jsi::String::createFromUtf8(rt, text);
}

} // namespace watermelondb
