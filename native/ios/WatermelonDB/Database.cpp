#include "Database.h"
#include "JSLockPerfHack.h"

namespace watermelondb {

SqliteDb::SqliteDb(std::string path) {
    assert(sqlite3_threadsafe());

    int resultOpen = sqlite3_open(path.c_str(), &sqlite);

    if (resultOpen != SQLITE_OK) {
        std::abort(); // Unimplemented
    }
    assert(sqlite != nullptr);
}

SqliteDb::~SqliteDb() {
    // TODO: finalize prepared statements
    // TODO: https://github.com/ccgus/fmdb/blob/master/src/fmdb/FMDatabase.m#L246 - error handling

    int resultClose = sqlite3_close(sqlite);

    if (resultClose != SQLITE_OK) {
        // std::abort(); // Unimplemented
    }
}

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

jsi::Function createFunction(jsi::Runtime &runtime,
                             const jsi::PropNameID &name,
                             unsigned int argCount,
                             std::function<jsi::Value(jsi::Runtime &rt, const jsi::Value *args)> func

) {
    std::string stdName = name.utf8(runtime);
    return jsi::Function::createFromHostFunction(runtime, name, argCount,
                                                 [stdName, argCount, func](jsi::Runtime &rt, const jsi::Value &,
                                                                           const jsi::Value *args, size_t count) {
                                                     assertCount(count, argCount, stdName);

                                                     return func(rt, args);
                                                 });
}

jsi::Value withJSCLockHolder(facebook::jsi::Runtime &rt, std::function<jsi::Value(void)> block) {
    jsi::Value retValue;
    watermelonCallWithJSCLockHolder(rt, [&]() { retValue = block(); });
    return retValue;
}

void Database::install(jsi::Runtime *runtime) {
    jsi::Runtime &rt = *runtime;
    {
        jsi::PropNameID name = jsi::PropNameID::forAscii(rt, "nativeWatermelonCreateAdapter");
        jsi::Function function = createFunction(rt, name, 1, [runtime](jsi::Runtime &rt, const jsi::Value *args) {
            std::string dbPath = args[0].getString(rt).utf8(rt);

            jsi::Object adapter(rt);

            std::shared_ptr<Database> database = std::make_shared<Database>(runtime, dbPath);
            adapter.setProperty(rt, "database", std::move(jsi::Object::createFromHostObject(rt, database)));

            {
                jsi::PropNameID name = jsi::PropNameID::forAscii(rt, "initialize");
                jsi::Function function = createFunction(rt, name, 2, [database](jsi::Runtime &rt, const jsi::Value *args) {
                    jsi::String dbName = args[0].getString(rt); // TODO: Check if dbName is ok
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
                        //                        consoleLog("Database has newer version (\(databaseVersion)) than what the " +
                        //                                   "app supports (\(schemaVersion)). Will reset database.")
                        response.setProperty(rt, "code", "schema_needed");
                    }

                    return response;
                });
                adapter.setProperty(rt, name, function);
            }
            {
                jsi::PropNameID name = jsi::PropNameID::forAscii(rt, "setUpWithSchema");
                jsi::Function function = createFunction(rt, name, 3, [database](jsi::Runtime &rt, const jsi::Value *args) {
                    jsi::String dbName = args[0].getString(rt); // TODO: Check if dbName is ok
                    jsi::String schema = args[1].getString(rt);
                    int schemaVersion = (int)args[2].getNumber();

                    // TODO: exceptions should kill app
                    database->unsafeResetDatabase(schema, schemaVersion);

                    database->initialized_ = true;
                    return jsi::Value::undefined();
                });
                adapter.setProperty(rt, name, function);
            }
            {
                jsi::PropNameID name = jsi::PropNameID::forAscii(rt, "setUpWithMigrations");
                jsi::Function function = createFunction(rt, name, 4, [database](jsi::Runtime &rt, const jsi::Value *args) {
                    jsi::String dbName = args[0].getString(rt); // TODO: Check if dbName is ok
                    jsi::String migrationSchema = args[1].getString(rt);
                    int fromVersion = (int)args[2].getNumber();
                    int toVersion = (int)args[4].getNumber();

                    // TODO: exceptions should kill app
                    database->migrate(migrationSchema, fromVersion, toVersion);

                    database->initialized_ = true;
                    return jsi::Value::undefined();
                });
                adapter.setProperty(rt, name, function);
            }
            {
                jsi::PropNameID name = jsi::PropNameID::forAscii(rt, "find");
                jsi::Function function = createFunction(rt, name, 2, [database](jsi::Runtime &rt, const jsi::Value *args) {
                    assert(database->initialized_);
                    jsi::String tableName = args[0].getString(rt);
                    jsi::String id = args[1].getString(rt);

                    return withJSCLockHolder(rt, [&]() { return database->find(tableName, id); });
                });
                adapter.setProperty(rt, name, function);
            }
            {
                jsi::PropNameID name = jsi::PropNameID::forAscii(rt, "query");
                jsi::Function function = createFunction(rt, name, 3, [database](jsi::Runtime &rt, const jsi::Value *args) {
                    assert(database->initialized_);
                    jsi::String tableName = args[0].getString(rt);
                    jsi::String sql = args[1].getString(rt);
                    jsi::Array arguments = args[2].getObject(rt).getArray(rt);

                    return withJSCLockHolder(rt, [&]() { return database->query(tableName, sql, arguments); });
                });
                adapter.setProperty(rt, name, function);
            }
            {
                jsi::PropNameID name = jsi::PropNameID::forAscii(rt, "count");
                jsi::Function function = createFunction(rt, name, 2, [database](jsi::Runtime &rt, const jsi::Value *args) {
                    assert(database->initialized_);
                    jsi::String sql = args[0].getString(rt);
                    jsi::Array arguments = args[1].getObject(rt).getArray(rt);

                    return withJSCLockHolder(rt, [&]() { return database->count(sql, arguments); });
                });
                adapter.setProperty(rt, name, function);
            }
            {
                jsi::PropNameID name = jsi::PropNameID::forAscii(rt, "batch");
                jsi::Function function = createFunction(rt, name, 1, [database](jsi::Runtime &rt, const jsi::Value *args) {
                    assert(database->initialized_);
                    jsi::Array operations = args[0].getObject(rt).getArray(rt);

                    watermelonCallWithJSCLockHolder(rt, [&]() { database->batch(operations); });

                    return jsi::Value::undefined();
                });
                adapter.setProperty(rt, name, function);
            }
            {
                jsi::PropNameID name = jsi::PropNameID::forAscii(rt, "getLocal");
                jsi::Function function = createFunction(rt, name, 1, [database](jsi::Runtime &rt, const jsi::Value *args) {
                    assert(database->initialized_);
                    jsi::String key = args[0].getString(rt);

                    return withJSCLockHolder(rt, [&]() { return database->getLocal(key); });
                });
                adapter.setProperty(rt, name, function);
            }
            {
                jsi::PropNameID name = jsi::PropNameID::forAscii(rt, "setLocal");
                jsi::Function function = createFunction(rt, name, 2, [database](jsi::Runtime &rt, const jsi::Value *args) {
                    assert(database->initialized_);
                    jsi::String key = args[0].getString(rt);
                    jsi::String value = args[1].getString(rt);

                    watermelonCallWithJSCLockHolder(rt, [&]() { database->setLocal(key, value); });

                    return jsi::Value::undefined();
                });
                adapter.setProperty(rt, name, function);
            }
            {
                jsi::PropNameID name = jsi::PropNameID::forAscii(rt, "removeLocal");
                jsi::Function function = createFunction(rt, name, 1, [database](jsi::Runtime &rt, const jsi::Value *args) {
                    assert(database->initialized_);
                    jsi::String key = args[0].getString(rt);

                    watermelonCallWithJSCLockHolder(rt, [&]() { database->removeLocal(key); });

                    return jsi::Value::undefined();
                });
                adapter.setProperty(rt, name, function);
            }
            {
                jsi::PropNameID name = jsi::PropNameID::forAscii(rt, "getDeletedRecords");
                jsi::Function function = createFunction(rt, name, 1, [database](jsi::Runtime &rt, const jsi::Value *args) {
                    assert(database->initialized_);
                    jsi::String tableName = args[0].getString(rt);

                    return withJSCLockHolder(rt, [&]() { return database->getDeletedRecords(tableName); });
                });
                adapter.setProperty(rt, name, function);
            }
            {
                jsi::PropNameID name = jsi::PropNameID::forAscii(rt, "destroyDeletedRecords");
                jsi::Function function = createFunction(rt, name, 2, [database](jsi::Runtime &rt, const jsi::Value *args) {
                    assert(database->initialized_);
                    jsi::String tableName = args[0].getString(rt);
                    jsi::Array recordIds = args[1].getObject(rt).getArray(rt);

                    watermelonCallWithJSCLockHolder(rt, [&]() { database->destroyDeletedRecords(tableName, recordIds); });

                    return jsi::Value::undefined();
                });
                adapter.setProperty(rt, name, function);
            }
            {
                jsi::PropNameID name = jsi::PropNameID::forAscii(rt, "unsafeResetDatabase");
                jsi::Function function = createFunction(rt, name, 2, [database](jsi::Runtime &rt, const jsi::Value *args) {
                    assert(database->initialized_);
                    jsi::String schema = args[0].getString(rt);
                    int schemaVersion = (int)args[1].getNumber();

                    watermelonCallWithJSCLockHolder(rt, [&]() { database->unsafeResetDatabase(schema, schemaVersion); });

                    return jsi::Value::undefined();
                });
                adapter.setProperty(rt, name, function);
            }

            return adapter;
        });
        rt.global().setProperty(rt, name, function);
    }
}

Database::~Database() {
}

bool Database::isCached(std::string tableName, std::string recordId) {
    auto recordSet = cachedRecords_[tableName];
    return recordSet.find(recordId) != recordSet.end();
}
void Database::markAsCached(std::string tableName, std::string recordId) {
    // TODO: what about duplicates?
    cachedRecords_[tableName].insert(recordId);
}
void Database::removeFromCache(std::string tableName, std::string recordId) {
    // TODO: will it remove all duplicates, if needed?
    cachedRecords_[tableName].erase(recordId);
}

void Database::executeUpdate(std::string sql, jsi::Array &args) {
    sqlite3_stmt *statement = executeQuery(sql, args);

    int stepResult = sqlite3_step(statement);

    if (stepResult != SQLITE_DONE) {
        sqlite3_reset(statement);
        throw dbError("Failed to execute db update");
    }

    int resetResult = sqlite3_reset(statement);

    if (resetResult != SQLITE_OK) {
        throw dbError("Failed to reset statement after executeUpdate");
    }
}

// TODO: Can we use templates or make jsi::Array iterable so we can avoid _creating_ jsi::Array in C++?
sqlite3_stmt *Database::executeQuery(std::string sql, jsi::Array &arguments) {
    auto &rt = getRt();
    sqlite3_stmt *statement = cachedStatements_[sql];

    if (statement == nullptr) {
        int resultPrepare = sqlite3_prepare_v2(db_->sqlite, sql.c_str(), -1, &statement, nullptr);

        if (resultPrepare != SQLITE_OK) {
            // TODO: Finalize
            // TODO: actual handling
            throw dbError("Failed to prepare query statement");
        }
        cachedStatements_[sql] = statement;
    } else {
        // in theory, this shouldn't be necessary, since staatements ought to be reset *after* use, not before use
        // but still this might prevent some crashes if this is not done right
        sqlite3_reset(statement);
    }
    assert(statement != nullptr);

    int argsCount = sqlite3_bind_parameter_count(statement);

    if (argsCount != arguments.length(rt)) {
        std::abort(); // Unimplemented
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
        } else {
            // TODO: Finalize
            throw jsi::JSError(rt, "Invalid argument type for query");
        }

        if (bindResult != SQLITE_OK) {
            // TODO: Finalize
            throw dbError("Failed to bind arguments for query");
        }
    }

    return statement;
}

jsi::Object Database::resultDictionary(sqlite3_stmt *statement) {
    auto &rt = getRt();
    jsi::Object dictionary(rt);

    for (int i = 0, len = sqlite3_column_count(statement); i < len; i++) {
        const char *column = sqlite3_column_name(statement, i);
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
        default: {
            throw jsi::JSError(rt, "Unable to fetch record from database - unknown column type (WatermelonDB does not "
                                   "support blobs or custom sqlite types currently)");
        }
        }
    }

    return dictionary;
}

int Database::getUserVersion() {
    auto &rt = getRt();
    auto args = jsi::Array::createWithElements(rt);
    sqlite3_stmt *statement = executeQuery("pragma user_version", args);

    int resultStep = sqlite3_step(statement); // todo: step_v2

    if (resultStep != SQLITE_ROW) {
        // TODO: Reset
        throw dbError("Failed to obtain database user_version");
    }

    assert(sqlite3_data_count(statement) == 1);

    int version = sqlite3_column_int(statement, 0);
    sqlite3_reset(statement);
    return version;
}

void Database::setUserVersion(int newVersion) {
    auto &rt = getRt();
    // NOTE: placeholders don't work, and ints are safe
    std::string sql = "pragma user_version = " + std::to_string(newVersion);
    auto args = jsi::Array::createWithElements(rt);
    executeUpdate(sql, args);
}

jsi::Value Database::find(jsi::String &tableName, jsi::String &id) {
    auto &rt = getRt();
    if (isCached(tableName.utf8(rt), id.utf8(rt))) {
        return jsi::String::createFromUtf8(rt, id.utf8(rt)); // TODO: why can't I return jsi::String?
    }

    auto args = jsi::Array::createWithElements(rt, id);
    sqlite3_stmt *statement = executeQuery("select * from " + tableName.utf8(rt) + " where id == ? limit 1", args);

    int stepResult = sqlite3_step(statement); // todo: step_v2

    if (stepResult == SQLITE_DONE) {
        return jsi::Value::null();
    }

    if (stepResult != SQLITE_ROW) {
        throw dbError("Failed to find a record in the database");
    }

    auto record = resultDictionary(statement);

    sqlite3_reset(statement);

    markAsCached(tableName.utf8(rt), id.utf8(rt));

    return record;
}

jsi::Value Database::query(jsi::String &tableName, jsi::String &sql, jsi::Array &arguments) {
    auto &rt = getRt();
    sqlite3_stmt *statement = executeQuery(sql.utf8(rt), arguments);

    jsi::Array records(rt, 0);

    for (size_t i = 0; true; i++) {
        int stepResult = sqlite3_step(statement); // todo: step_v2

        if (stepResult == SQLITE_DONE) {
            break;
        }

        if (stepResult != SQLITE_ROW) {
            throw dbError("Failed to query the database");
        }

        assert(std::string(sqlite3_column_name(statement, 0)) == "id");

        const char *id = (const char *)sqlite3_column_text(statement, 0);
        if (!id) {
            throw jsi::JSError(rt, "Failed to get ID of a record");
        }

        if (isCached(tableName.utf8(rt), std::string(id))) {
            jsi::String jsiId = jsi::String::createFromAscii(rt, id);
            records.setValueAtIndex(rt, i, std::move(jsiId));
        } else {
            markAsCached(tableName.utf8(rt), std::string(id));
            jsi::Object record = resultDictionary(statement);
            records.setValueAtIndex(rt, i, std::move(record));
        }
    }

    sqlite3_reset(statement);

    return records;
}

jsi::Value Database::count(jsi::String &sql, jsi::Array &arguments) {
    auto &rt = getRt();
    sqlite3_stmt *statement = executeQuery(sql.utf8(rt), arguments);

    int stepResult = sqlite3_step(statement);

    if (stepResult != SQLITE_ROW) {
        throw dbError("Failed to query a count");
    }

    assert(sqlite3_data_count(statement) == 1);

    int count = sqlite3_column_int(statement, 0);

    sqlite3_reset(statement);

    return jsi::Value(count);
}

void Database::batch(jsi::Array &operations) {
    auto &rt = getRt();
    sqlite3_exec(db_->sqlite, "begin exclusive transaction", nullptr, nullptr, nullptr); // TODO: clean up

    size_t operationsCount = operations.length(rt);
    // TODO: modify caches at the end of transaction
    for (size_t i = 0; i < operationsCount; i++) {
        jsi::Array operation = operations.getValueAtIndex(rt, i).getObject(rt).getArray(rt);
        std::string type = operation.getValueAtIndex(rt, 0).getString(rt).utf8(rt);
        const jsi::String table = operation.getValueAtIndex(rt, 1).getString(rt);

        if (type == "create") {
            std::string id = operation.getValueAtIndex(rt, 2).getString(rt).utf8(rt);
            jsi::String sql = operation.getValueAtIndex(rt, 3).getString(rt);
            jsi::Array arguments = operation.getValueAtIndex(rt, 4).getObject(rt).getArray(rt);

            executeUpdate(sql.utf8(rt), arguments);
            markAsCached(table.utf8(rt), id);
        } else if (type == "execute") {
            jsi::String sql = operation.getValueAtIndex(rt, 2).getString(rt);
            jsi::Array arguments = operation.getValueAtIndex(rt, 3).getObject(rt).getArray(rt);

            executeUpdate(sql.utf8(rt), arguments);
        } else if (type == "markAsDeleted") {
            const jsi::String id = operation.getValueAtIndex(rt, 2).getString(rt);
            auto args = jsi::Array::createWithElements(rt, id);
            executeUpdate("update " + table.utf8(rt) + " set _status='deleted' where id == ?", args);
            removeFromCache(table.utf8(rt), id.utf8(rt));
        } else if (type == "destroyPermanently") {
            const jsi::String id = operation.getValueAtIndex(rt, 2).getString(rt);
            auto args = jsi::Array::createWithElements(rt, id);

            // TODO: What's the behavior if nothing got deleted?
            executeUpdate("delete from " + table.utf8(rt) + " where id == ?", args);
            removeFromCache(table.utf8(rt), id.utf8(rt));
        } else {
            throw jsi::JSError(rt, "Invalid operation type");
        }
    }

    sqlite3_exec(db_->sqlite, "commit transaction", nullptr, nullptr, nullptr); // TODO: clean up
}

jsi::Array Database::getDeletedRecords(jsi::String &tableName) {
    auto &rt = getRt();
    auto args = jsi::Array::createWithElements(*runtime_);
    sqlite3_stmt *statement = executeQuery("select id from " + tableName.utf8(rt) + " where _status='deleted'", args);

    jsi::Array records(rt, 0);

    for (size_t i = 0; true; i++) {
        int stepResult = sqlite3_step(statement); // todo: step_v2

        if (stepResult == SQLITE_DONE) {
            break;
        }

        if (stepResult != SQLITE_ROW) {
            throw dbError("Failed to get deleted records");
        }

        assert(sqlite3_data_count(statement) == 1);

        const char *idText = (const char *)sqlite3_column_text(statement, 0);
        if (!idText) {
            throw jsi::JSError(rt, "Failed to get ID of a record");
        }

        jsi::String id = jsi::String::createFromAscii(rt, idText);
        records.setValueAtIndex(rt, i, id);
    }

    sqlite3_reset(statement);

    return records;
}

void Database::destroyDeletedRecords(jsi::String &tableName, jsi::Array &recordIds) {
    auto &rt = getRt();
    sqlite3_exec(db_->sqlite, "begin exclusive transaction", nullptr, nullptr, nullptr); // TODO: clean up

    // TODO: Maybe it's faster & easier to do it in one query?
    std::string sql = "delete from " + tableName.utf8(rt) + " where id == ?";

    for (size_t i = 0, len = recordIds.size(rt); i < len; i++) {
        // TODO: What's the behavior if record doesn't exist or isn't actually deleted?
        jsi::String id = recordIds.getValueAtIndex(rt, i).getString(rt);
        auto args = jsi::Array::createWithElements(rt, id);
        executeUpdate(sql, args);
    }

    sqlite3_exec(db_->sqlite, "commit transaction", nullptr, nullptr, nullptr); // TODO: clean up
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
    sqlite3_exec(db_->sqlite, "begin exclusive transaction", nullptr, nullptr, nullptr); // TODO: clean up

    // TODO: delete file in non-test?

    // Destroy everything
    auto args = jsi::Array::createWithElements(rt);
    sqlite3_stmt *statement = executeQuery("select name from sqlite_master where type='table'", args);

    std::vector<std::string> tables = {};

    for (size_t i = 0; true; i++) {
        int resultStep = sqlite3_step(statement); // todo: step_v2

        if (resultStep == SQLITE_DONE) {
            break;
        }

        if (resultStep != SQLITE_ROW) {
            std::abort(); // Unimplemented
        }

        assert(sqlite3_data_count(statement) == 1);

        const char *tableName = (const char *)sqlite3_column_text(statement, 0);

        if (!tableName) {
            std::abort(); // Unimplemented
        }

        tables.push_back(std::string(tableName));
    }

    sqlite3_reset(statement); // TODO: check status?

    for (auto const &table : tables) {
        std::string sql = "drop table if exists " + table;

        char *errmsg = nullptr;
        sqlite3_exec(db_->sqlite, sql.c_str(), nullptr, nullptr, &errmsg); // TODO: clean up

        if (errmsg) {
            std::string message(errmsg);
            sqlite3_free(errmsg);
            throw jsi::JSError(rt, message); // abort?
        }
    }

    sqlite3_exec(db_->sqlite, "pragma writable_schema=1; delete from sqlite_master; pragma user_version=0; pragma writable_schema=0",
                 nullptr, nullptr, nullptr); // TODO: clean up

    cachedRecords_ = {};

    // Reinitialize schema
    std::string sql = schema.utf8(rt) + localStorageSchema;

    char *errmsg = nullptr;
    int resultExec = sqlite3_exec(db_->sqlite, sql.c_str(), nullptr, nullptr, &errmsg);

    if (errmsg) {
        std::string message(errmsg);
        sqlite3_free(errmsg);
        throw jsi::JSError(rt, message); // abort?
    }

    if (resultExec != SQLITE_OK) {
        std::abort(); // Unimplemented
    }

    setUserVersion(schemaVersion);

    sqlite3_exec(db_->sqlite, "commit transaction", nullptr, nullptr, nullptr); // TODO: clean up
}

void Database::migrate(jsi::String &migrationSql, int fromVersion, int toVersion) {
    auto &rt = getRt();
    assert(getUserVersion() == fromVersion && "Incompatible migration set");

    sqlite3_exec(db_->sqlite, "begin exclusive transaction", nullptr, nullptr, nullptr); // TODO: clean up

    //        try database.executeStatements(migrations.sql)
    //        database.userVersion = migrations.to

    std::string sql = migrationSql.utf8(rt);

    // TODO: deduplicate
    char *errmsg = nullptr;
    int resultExec = sqlite3_exec(db_->sqlite, sql.c_str(), nullptr, nullptr, &errmsg);

    if (errmsg) {
        std::string message(errmsg);
        sqlite3_free(errmsg);
        throw jsi::JSError(rt, message); // abort?
    }

    if (resultExec != SQLITE_OK) {
        std::abort(); // Unimplemented
    }

    sqlite3_exec(db_->sqlite, "commit transaction", nullptr, nullptr, nullptr); // TODO: clean up
}

jsi::Value Database::getLocal(jsi::String &key) {
    auto &rt = getRt();
    auto args = jsi::Array::createWithElements(rt, key);
    sqlite3_stmt *statement = executeQuery("select value from local_storage where key = ?", args);

    int resultStep = sqlite3_step(statement); // todo: step_v2

    if (resultStep == SQLITE_DONE) {
        return jsi::Value::null();
    }

    if (resultStep != SQLITE_ROW) {
        std::abort(); // Unimplemented
    }

    // sanity check - do we even need it? maybe debug only?
    if (sqlite3_data_count(statement) != 1) {
        std::abort();
    }

    const char *text = (const char *)sqlite3_column_text(statement, 0);

    if (!text) {
        sqlite3_reset(statement);
        return jsi::Value::null();
    }

    jsi::Value returnValue = jsi::String::createFromAscii(rt, text);
    sqlite3_reset(statement);

    return std::move(returnValue);
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
