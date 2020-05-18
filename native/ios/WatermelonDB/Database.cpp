#include "Database.h"
#include "DatabasePlatform.h"
#include "JSLockPerfHack.h"

namespace watermelondb {

using platform::consoleError;
using platform::consoleLog;

Database::Database(jsi::Runtime *runtime, std::string path) : runtime_(runtime) {
    db_ = std::make_unique<SqliteDb>(path);
}

jsi::Runtime &Database::getRt() {
    return *runtime_;
}

void assertCount(size_t count, size_t expected, std::string name) {
    if (count != expected) {
        std::string error = name + " takes " + std::to_string(expected) + " arguments";
        throw std::invalid_argument(error);
    }
}

jsi::JSError Database::dbError(std::string description) {
    // TODO: In serialized threading mode, those may be incorrect - probably smarter to pass result codes around?
    auto sqliteMessage = std::string(sqlite3_errmsg(db_->sqlite));
    auto code = sqlite3_extended_errcode(db_->sqlite);
    auto message = description + " - sqlite error " + std::to_string(code) + " (" + sqliteMessage + ")";
    auto &rt = getRt();
    return jsi::JSError(rt, message);
}

jsi::Value withJSCLockHolder(facebook::jsi::Runtime &rt, std::function<jsi::Value(void)> block) {
    jsi::Value retValue;
    watermelonCallWithJSCLockHolder(rt, [&]() { retValue = block(); });
    return retValue;
}

using jsiFunction = std::function<jsi::Value(jsi::Runtime &rt, const jsi::Value *args)>;

jsi::Function createFunction(jsi::Runtime &runtime, const jsi::PropNameID &name, unsigned int argCount, jsiFunction func

) {
    std::string stdName = name.utf8(runtime);
    return jsi::Function::createFromHostFunction(runtime, name, argCount,
                                                 [stdName, argCount, func](jsi::Runtime &rt, const jsi::Value &,
                                                                           const jsi::Value *args, size_t count) {
                                                     assertCount(count, argCount, stdName);

                                                     return func(rt, args);
                                                 });
}

void createMethod(jsi::Runtime &rt, jsi::Object &object, const char *methodName, unsigned int argCount, jsiFunction func) {
    jsi::PropNameID name = jsi::PropNameID::forAscii(rt, methodName);
    jsi::Function function = createFunction(rt, name, argCount, func);
    object.setProperty(rt, name, function);
}

void Database::install(jsi::Runtime *runtime) {
    jsi::Runtime &rt = *runtime;
    auto globalObject = rt.global();
    createMethod(rt, globalObject, "nativeWatermelonCreateAdapter", 1, [runtime](jsi::Runtime &rt, const jsi::Value *args) {
        std::string dbPath = args[0].getString(rt).utf8(rt);

        jsi::Object adapter(rt);

        std::shared_ptr<Database> database = std::make_shared<Database>(runtime, dbPath);
        adapter.setProperty(rt, "database", jsi::Object::createFromHostObject(rt, database));

        createMethod(rt, adapter, "initialize", 2, [database](jsi::Runtime &rt, const jsi::Value *args) {
            jsi::String dbName = args[0].getString(rt);
            int expectedVersion = (int)args[1].getNumber();

            int databaseVersion = database->getUserVersion();

            jsi::Object response(rt);

            if (databaseVersion == expectedVersion) {
                database->initialized_ = true;
                response.setProperty(rt, "code", "ok");
            } else if (databaseVersion == 0) {
                response.setProperty(rt, "code", "schema_needed");
            } else if (databaseVersion < expectedVersion) {
                response.setProperty(rt, "code", "migrations_needed");
                response.setProperty(rt, "databaseVersion", databaseVersion);
            } else {
                consoleLog("Database has newer version (" + std::to_string(databaseVersion) +
                           ") than what the app supports (" + std::to_string(expectedVersion) + "). Will reset database.");
                response.setProperty(rt, "code", "schema_needed");
            }

            return response;
        });
        createMethod(rt, adapter, "setUpWithSchema", 3, [database](jsi::Runtime &rt, const jsi::Value *args) {
            jsi::String dbName = args[0].getString(rt);
            jsi::String schema = args[1].getString(rt);
            int schemaVersion = (int)args[2].getNumber();

            try {
                database->unsafeResetDatabase(schema, schemaVersion);
            } catch (const std::exception &ex) {
                consoleError("Failed to set up the database correctly - " + std::string(ex.what()));
                std::abort();
            }

            database->initialized_ = true;
            return jsi::Value::undefined();
        });
        createMethod(rt, adapter, "setUpWithMigrations", 4, [database](jsi::Runtime &rt, const jsi::Value *args) {
            jsi::String dbName = args[0].getString(rt);
            jsi::String migrationSchema = args[1].getString(rt);
            int fromVersion = (int)args[2].getNumber();
            int toVersion = (int)args[3].getNumber();

            try {
                database->migrate(migrationSchema, fromVersion, toVersion);
            } catch (const std::exception &ex) {
                consoleError("Failed to migrate the database correctly - " + std::string(ex.what()));
                throw;
            }

            database->initialized_ = true;
            return jsi::Value::undefined();
        });
        createMethod(rt, adapter, "find", 2, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String tableName = args[0].getString(rt);
            jsi::String id = args[1].getString(rt);

            return withJSCLockHolder(rt, [&]() { return database->find(tableName, id); });
        });
        createMethod(rt, adapter, "query", 3, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String tableName = args[0].getString(rt);
            jsi::String sql = args[1].getString(rt);
            jsi::Array arguments = args[2].getObject(rt).getArray(rt);

            return withJSCLockHolder(rt, [&]() { return database->query(tableName, sql, arguments); });
        });
        createMethod(rt, adapter, "count", 2, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String sql = args[0].getString(rt);
            jsi::Array arguments = args[1].getObject(rt).getArray(rt);

            return withJSCLockHolder(rt, [&]() { return database->count(sql, arguments); });
        });
        createMethod(rt, adapter, "batch", 1, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::Array operations = args[0].getObject(rt).getArray(rt);

            watermelonCallWithJSCLockHolder(rt, [&]() { database->batch(operations); });

            return jsi::Value::undefined();
        });
        createMethod(rt, adapter, "getLocal", 1, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String key = args[0].getString(rt);

            return withJSCLockHolder(rt, [&]() { return database->getLocal(key); });
        });
        createMethod(rt, adapter, "setLocal", 2, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String key = args[0].getString(rt);
            jsi::String value = args[1].getString(rt);

            return withJSCLockHolder(rt, [&]() {
                database->setLocal(key, value);
                return jsi::Value::undefined();
            });
        });
        createMethod(rt, adapter, "removeLocal", 1, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String key = args[0].getString(rt);

            watermelonCallWithJSCLockHolder(rt, [&]() { database->removeLocal(key); });

            return jsi::Value::undefined();
        });
        createMethod(rt, adapter, "getDeletedRecords", 1, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String tableName = args[0].getString(rt);

            return withJSCLockHolder(rt, [&]() { return database->getDeletedRecords(tableName); });
        });
        createMethod(rt, adapter, "destroyDeletedRecords", 2, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String tableName = args[0].getString(rt);
            jsi::Array recordIds = args[1].getObject(rt).getArray(rt);

            watermelonCallWithJSCLockHolder(rt, [&]() { database->destroyDeletedRecords(tableName, recordIds); });

            return jsi::Value::undefined();
        });
        createMethod(rt, adapter, "unsafeResetDatabase", 2, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String schema = args[0].getString(rt);
            int schemaVersion = (int)args[1].getNumber();

            watermelonCallWithJSCLockHolder(rt, [&]() {
                try {
                    database->unsafeResetDatabase(schema, schemaVersion);
                } catch (const std::exception &ex) {
                    consoleError("Failed to reset database correctly - " + std::string(ex.what()));
                    // Partially reset database is likely corrupted, so it's probably less bad to crash
                    std::abort();
                }
            });

            return jsi::Value::undefined();
        });

        return adapter;
    });

    // TODO: Use the onMemoryAlert hook!
}

Database::~Database() {
    for (auto const &cachedStatement: cachedStatements_ ) {
        sqlite3_stmt *statement = cachedStatement.second;
        sqlite3_finalize(statement);
    }
    cachedStatements_ = {};
}

std::string cacheKey(std::string tableName, std::string recordId) {
    return tableName + "$" + recordId; // NOTE: safe as long as neither table names nor record ids can contain $ sign
}

bool Database::isCached(std::string cacheKey) {
    return cachedRecords_.find(cacheKey) != cachedRecords_.end();
}
void Database::markAsCached(std::string cacheKey) {
    // TODO: what about duplicates?
    cachedRecords_.insert(cacheKey);
}
void Database::removeFromCache(std::string cacheKey) {
    // TODO: will it remove all duplicates, if needed?
    cachedRecords_.erase(cacheKey);
}

// TODO: Can we use templates or make jsi::Array iterable so we can avoid _creating_ jsi::Array in C++?
SqliteStatement Database::executeQuery(std::string sql, jsi::Array &arguments) {
    auto &rt = getRt();
    sqlite3_stmt *statement = cachedStatements_[sql];

    if (statement == nullptr) {
        int resultPrepare = sqlite3_prepare_v2(db_->sqlite, sql.c_str(), -1, &statement, nullptr);

        if (resultPrepare != SQLITE_OK) {
            sqlite3_finalize(statement);
            throw dbError("Failed to prepare query statement");
        }

        assert(statement != nullptr);
        cachedStatements_[sql] = statement;
    } else {
        // in theory, this shouldn't be necessary, since statements ought to be reset *after* use, not before use
        // but still this might prevent some crashes if this is not done right
        // TODO: Remove this later - should not be necessary, and it wastes time
        sqlite3_reset(statement);
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
            throw dbError("Failed to bind an argument for query");
        }
    }

    // TODO: We may move this initialization earlier to avoid having to care about sqlite3_reset, but I think we'll
    // have to implement a move constructor for it to be correct
    return SqliteStatement(statement);
}

void Database::executeUpdate(std::string sql, jsi::Array &args) {
    auto statement = executeQuery(sql, args);
    int stepResult = sqlite3_step(statement.stmt);

    if (stepResult != SQLITE_DONE) {
        throw dbError("Failed to execute db update");
    }
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
            int value = sqlite3_column_int(statement, i);
            dictionary.setProperty(rt, column, std::move(jsi::Value(value)));
            break;
        }
        case SQLITE_FLOAT: {
            double value = sqlite3_column_double(statement, i);
            dictionary.setProperty(rt, column, std::move(jsi::Value(value)));
            break;
        }
        case SQLITE_TEXT: {
            const char *text = (const char *)sqlite3_column_text(statement, i);

            if (text) {
                dictionary.setProperty(rt, column, std::move(jsi::String::createFromAscii(rt, text)));
            } else {
                dictionary.setProperty(rt, column, std::move(jsi::Value::null()));
            }

            break;
        }
        case SQLITE_NULL: {
            dictionary.setProperty(rt, column, std::move(jsi::Value::null()));
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
    consoleError("WatermelonDB sqlite transaction is being rolled back! This is BAD - it means that there's either a WatermelonDB bug or a user issue (e.g. no empty disk space) that Watermelon may be unable to recover from safely... Do investigate!");
    executeUpdate("rollback transaction"); // TODO: Use RAII to rollback automatically!
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
    auto &rt = getRt();
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
    auto statement = executeQuery("select * from " + tableName.utf8(rt) + " where id == ? limit 1", args);

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

    jsi::Array records(rt, 0);

    for (size_t i = 0; true; i++) {
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
            records.setValueAtIndex(rt, i, std::move(jsiId));
        } else {
            markAsCached(cacheKey(tableName.utf8(rt), std::string(id)));
            jsi::Object record = resultDictionary(statement.stmt);
            records.setValueAtIndex(rt, i, std::move(record));
        }
    }

    return records;
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
        // TODO: modify caches at the end of transaction
        for (size_t i = 0; i < operationsCount; i++) {
            jsi::Array operation = operations.getValueAtIndex(rt, i).getObject(rt).getArray(rt);
            std::string type = operation.getValueAtIndex(rt, 0).getString(rt).utf8(rt);
            const jsi::String table = operation.getValueAtIndex(rt, 1).getString(rt);

            if (type == "create") {
                std::string id = operation.getValueAtIndex(rt, 2).getString(rt).utf8(rt);
                std::string sql = operation.getValueAtIndex(rt, 3).getString(rt).utf8(rt);
                jsi::Array arguments = operation.getValueAtIndex(rt, 4).getObject(rt).getArray(rt);

                executeUpdate(sql, arguments);
                addedIds.push_back(cacheKey(table.utf8(rt), id));
            } else if (type == "execute") {
                jsi::String sql = operation.getValueAtIndex(rt, 2).getString(rt);
                jsi::Array arguments = operation.getValueAtIndex(rt, 3).getObject(rt).getArray(rt);

                executeUpdate(sql.utf8(rt), arguments);
            } else if (type == "markAsDeleted") {
                const jsi::String id = operation.getValueAtIndex(rt, 2).getString(rt);
                auto args = jsi::Array::createWithElements(rt, id);
                executeUpdate("update " + table.utf8(rt) + " set _status='deleted' where id == ?", args);

                removedIds.push_back(cacheKey(table.utf8(rt), id.utf8(rt)));
            } else if (type == "destroyPermanently") {
                const jsi::String id = operation.getValueAtIndex(rt, 2).getString(rt);
                auto args = jsi::Array::createWithElements(rt, id);

                // TODO: What's the behavior if nothing got deleted?
                executeUpdate("delete from " + table.utf8(rt) + " where id == ?", args);
                removedIds.push_back(cacheKey(table.utf8(rt), id.utf8(rt)));
            } else {
                throw jsi::JSError(rt, "Invalid operation type");
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

jsi::Array Database::getDeletedRecords(jsi::String &tableName) {
    auto &rt = getRt();
    auto args = jsi::Array::createWithElements(rt);
    auto statement = executeQuery("select id from " + tableName.utf8(rt) + " where _status='deleted'", args);

    jsi::Array records(rt, 0);

    for (size_t i = 0; true; i++) {
        int stepResult = sqlite3_step(statement.stmt);

        if (stepResult == SQLITE_DONE) {
            break;
        } else if (stepResult != SQLITE_ROW) {
            throw dbError("Failed to get deleted records");
        }

        assert(sqlite3_data_count(statement.stmt) == 1);

        const char *idText = (const char *)sqlite3_column_text(statement.stmt, 0);
        if (!idText) {
            throw jsi::JSError(rt, "Failed to get ID of a record");
        }

        jsi::String id = jsi::String::createFromAscii(rt, idText);
        records.setValueAtIndex(rt, i, id);
    }

    return records;
}

void Database::destroyDeletedRecords(jsi::String &tableName, jsi::Array &recordIds) {
    auto &rt = getRt();
    beginTransaction();
    try {
        // TODO: Maybe it's faster & easier to do it in one query?
        std::string sql = "delete from " + tableName.utf8(rt) + " where id == ?";

        for (size_t i = 0, len = recordIds.size(rt); i < len; i++) {
            // TODO: What's the behavior if record doesn't exist or isn't actually deleted?
            jsi::String id = recordIds.getValueAtIndex(rt, i).getString(rt);
            auto args = jsi::Array::createWithElements(rt, id);
            executeUpdate(sql, args);
        }
        commit();
    } catch (const std::exception &ex) {
        rollback();
        throw;
    }
}

const std::string localStorageSchema = R"(
create table local_storage (
key varchar(16) primary key not null,
value text not null
);

create index local_storage_key_index on local_storage (key);
)";

void Database::unsafeResetDatabase(jsi::String &schema, int schemaVersion) {
    auto &rt = getRt();
    beginTransaction();
    try {
        // TODO: delete file in non-test?

        std::vector<std::string> tables = {};

        // Find all tables (scope to reset SqliteStatement)
        {
            auto args = jsi::Array::createWithElements(rt);
            auto statement = executeQuery("select name from sqlite_master where type='table'", args);

            for (size_t i = 0; true; i++) {
                int stepResult = sqlite3_step(statement.stmt);

                if (stepResult == SQLITE_DONE) {
                    break;
                } else if (stepResult != SQLITE_ROW) {
                    throw dbError("Failed to get table names to delete");
                }

                assert(sqlite3_data_count(statement.stmt) == 1);
                const char *tableName = (const char *)sqlite3_column_text(statement.stmt, 0);
                if (!tableName) {
                    throw jsi::JSError(rt, "Failed to get table name to delete");
                }

                tables.push_back(std::string(tableName));
            }
        }

        // Destroy everything
        for (auto const &table : tables) {
            executeUpdate("drop table if exists " + table);
        }

        executeUpdate("pragma writable_schema=1");
        executeUpdate("delete from sqlite_master");
        executeUpdate("pragma user_version=0");
        executeUpdate("pragma writable_schema=0");

        cachedRecords_ = {};

        // Reinitialize schema
        executeMultiple(schema.utf8(rt) + localStorageSchema);
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

    return jsi::String::createFromAscii(rt, text);
}

void Database::setLocal(jsi::String &key, jsi::String &value) {
    auto &rt = getRt();
    auto args = jsi::Array::createWithElements(rt, key, value);
    executeUpdate("insert or replace into local_storage (key, value) values (?, ?)", args);
}

void Database::removeLocal(jsi::String &key) {
    auto &rt = getRt();
    auto args = jsi::Array::createWithElements(rt, key);
    executeUpdate("delete from local_storage where key == ?", args);
}

} // namespace watermelondb
