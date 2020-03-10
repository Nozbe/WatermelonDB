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
//        std::abort(); // Unimplemented
    }
}

Database::Database(jsi::Runtime *runtime) : runtime_(runtime) {
    jsi::Runtime& rt = *runtime;

    /* set up database */

    db_ = std::make_unique<SqliteDb>("file:jsitests?mode=memory&cache=shared");

    /* set up jsi bindings */

    {
        const char *name = "nativeWatermelonFind";
        jsi::PropNameID propName = jsi::PropNameID::forAscii(rt, name);
        jsi::Function function = jsi::Function::createFromHostFunction(rt, propName, 2, [this](
                                                                                               jsi::Runtime &runtime,
                                                                                               const jsi::Value &,
                                                                                               const jsi::Value *args,
                                                                                               size_t count
                                                                                               ) {
            if (count != 2) {
                throw std::invalid_argument("nativeWatermelonFind takes 2 arguments");
            }

            jsi::Runtime &rt = *runtime_;
            jsi::String tableName = args[0].getString(rt);
            jsi::String id = args[1].getString(rt);

            jsi::Value retValue;
            callWithJSCLockHolder(rt, [&]() {
                retValue = find(rt, tableName, id);
            });

            return retValue;
        });
        rt.global().setProperty(rt, name, function);
    }
    {
        const char *name = "nativeWatermelonQuery";
        jsi::PropNameID propName = jsi::PropNameID::forAscii(rt, name);
        jsi::Function function = jsi::Function::createFromHostFunction(rt, propName, 3, [this](
                                                                                               jsi::Runtime &runtime,
                                                                                               const jsi::Value &,
                                                                                               const jsi::Value *args,
                                                                                               size_t count
                                                                                               ) {
            if (count != 3) {
                throw std::invalid_argument("nativeWatermelonQuery takes 3 arguments");
            }

            jsi::Runtime &rt = *runtime_;
            jsi::String tableName = args[0].getString(rt);
            jsi::String sql = args[1].getString(rt);
            jsi::Array arguments = args[2].getObject(rt).getArray(rt);

            jsi::Value retValue;
            callWithJSCLockHolder(rt, [&]() {
                retValue = query(rt, tableName, sql, arguments);
            });

            return retValue;
        });
        rt.global().setProperty(rt, name, function);
    }
    {
        const char *name = "nativeWatermelonCount";
        jsi::PropNameID propName = jsi::PropNameID::forAscii(rt, name);
        jsi::Function function = jsi::Function::createFromHostFunction(rt, propName, 2, [this](
                                                                                               jsi::Runtime &runtime,
                                                                                               const jsi::Value &,
                                                                                               const jsi::Value *args,
                                                                                               size_t count
                                                                                               ) {
            if (count != 2) {
                throw std::invalid_argument("nativeWatermelonCount takes 2 arguments");
            }

            jsi::Runtime &rt = *runtime_;
            jsi::String sql = args[0].getString(rt);
            jsi::Array arguments = args[1].getObject(rt).getArray(rt);

            jsi::Value retValue;
            callWithJSCLockHolder(rt, [&]() {
                retValue = this->count(rt, sql, arguments);
            });

            return retValue;
        });
        rt.global().setProperty(rt, name, function);
    }
    {
        const char *name = "nativeWatermelonBatch";
        jsi::PropNameID propName = jsi::PropNameID::forAscii(rt, name);
        jsi::Function function = jsi::Function::createFromHostFunction(rt, propName, 1, [this](
            jsi::Runtime &runtime,
            const jsi::Value &,
            const jsi::Value *args,
            size_t count
        ) {
            if (count != 1) {
              throw std::invalid_argument("nativeWatermelonBatch takes 1 argument");
            }

            jsi::Runtime &rt = *runtime_;
            jsi::Array operations = args[0].getObject(rt).getArray(rt);

            callWithJSCLockHolder(rt, [&]() {
                batch(rt, operations);
            });

            return jsi::Value::undefined();
        });
        rt.global().setProperty(rt, name, function);
    }
    {
        const char *name = "nativeWatermelonGetLocal";
        jsi::PropNameID propName = jsi::PropNameID::forAscii(rt, name);
        jsi::Function function = jsi::Function::createFromHostFunction(rt, propName, 1, [this](
                                                                                               jsi::Runtime &runtime,
                                                                                               const jsi::Value &,
                                                                                               const jsi::Value *args,
                                                                                               size_t count
                                                                                               ) {
            if (count != 1) {
                throw std::invalid_argument("nativeWatermelonGetLocal takes 1 arguments");
            }

            jsi::Runtime &rt = *runtime_;
            jsi::String key = args[0].getString(rt);

            jsi::Value retValue;
            callWithJSCLockHolder(rt, [&]() {
                retValue = getLocal(rt, key);
            });

            return retValue;
        });
        rt.global().setProperty(rt, name, function);
    }
    {
        const char *name = "nativeWatermelonSetLocal";
        jsi::PropNameID propName = jsi::PropNameID::forAscii(rt, name);
        jsi::Function function = jsi::Function::createFromHostFunction(rt, propName, 2, [this](
                                                                                               jsi::Runtime &runtime,
                                                                                               const jsi::Value &,
                                                                                               const jsi::Value *args,
                                                                                               size_t count
                                                                                               ) {
            if (count != 2) {
                throw std::invalid_argument("nativeWatermelonSetLocal takes 2 arguments");
            }

            jsi::Runtime &rt = *runtime_;
            jsi::String key = args[0].getString(rt);
            jsi::String value = args[1].getString(rt);

            callWithJSCLockHolder(rt, [&]() {
                setLocal(rt, key, value);
            });

            return jsi::Value::undefined();
        });
        rt.global().setProperty(rt, name, function);
    }
    {
        const char *name = "nativeWatermelonRemoveLocal";
        jsi::PropNameID propName = jsi::PropNameID::forAscii(rt, name);
        jsi::Function function = jsi::Function::createFromHostFunction(rt, propName, 1, [this](
                                                                                               jsi::Runtime &runtime,
                                                                                               const jsi::Value &,
                                                                                               const jsi::Value *args,
                                                                                               size_t count
                                                                                               ) {
            if (count != 1) {
                throw std::invalid_argument("nativeWatermelonRemoveLocal takes 1 arguments");
            }

            jsi::Runtime &rt = *runtime_;
            jsi::String key = args[0].getString(rt);

            callWithJSCLockHolder(rt, [&]() {
                removeLocal(rt, key);
            });

            return jsi::Value::undefined();
        });
        rt.global().setProperty(rt, name, function);
    }
    {
        const char *name = "nativeWatermelonGetDeletedRecords";
        jsi::PropNameID propName = jsi::PropNameID::forAscii(rt, name);
        jsi::Function function = jsi::Function::createFromHostFunction(rt, propName, 1, [this](
                                                                                               jsi::Runtime &runtime,
                                                                                               const jsi::Value &,
                                                                                               const jsi::Value *args,
                                                                                               size_t count
                                                                                               ) {
            if (count != 1) {
                throw std::invalid_argument("nativeWatermelonGetDeletedRecords takes 1 arguments");
            }

            jsi::Runtime &rt = *runtime_;
            jsi::String tableName = args[0].getString(rt);

            jsi::Value retValue;
            callWithJSCLockHolder(rt, [&]() {
                retValue = getDeletedRecords(rt, tableName);
            });

            return retValue;
        });
        rt.global().setProperty(rt, name, function);
    }
    {
        const char *name = "nativeWatermelonDestroyDeletedRecords";
        jsi::PropNameID propName = jsi::PropNameID::forAscii(rt, name);
        jsi::Function function = jsi::Function::createFromHostFunction(rt, propName, 2, [this](
                                                                                               jsi::Runtime &runtime,
                                                                                               const jsi::Value &,
                                                                                               const jsi::Value *args,
                                                                                               size_t count
                                                                                               ) {
            if (count != 2) {
                throw std::invalid_argument("nativeWatermelonDestroyDeletedRecords takes 2 arguments");
            }

            jsi::Runtime &rt = *runtime_;
            jsi::String tableName = args[0].getString(rt);
            jsi::Array recordIds = args[1].getObject(rt).getArray(rt);

            callWithJSCLockHolder(rt, [&]() {
                destroyDeletedRecords(rt, tableName, recordIds);
            });

            return jsi::Value::undefined();
        });
        rt.global().setProperty(rt, name, function);
    }
}

void Database::install(jsi::Runtime *runtime) {
    jsi::Runtime& rt = *runtime;

    std::shared_ptr<Database> database = std::make_shared<Database>(runtime);
    rt.global().setProperty(*runtime, "nativeWatermelonDatabase", std::move(jsi::Object::createFromHostObject(rt, database)));
}

Database::~Database() {

}

void Database::executeUpdate(jsi::Runtime& rt, std::string sql, jsi::Array& arguments) {
    // TODO: Can we use templates or make jsi::Array iterable so we can avoid _creating_ jsi::Array in C++?

    sqlite3_stmt *statement = cachedStatements_[sql];
    // TODO: Do we need to reset cached statement before use?
    if (statement == nullptr) {
        int resultPrepare = sqlite3_prepare_v2(db_->sqlite, sql.c_str(), -1, &statement, nullptr);

        if (resultPrepare != SQLITE_OK) {
            std::abort(); // Unimplemented
        }
        cachedStatements_[sql] = statement;
    }
    assert(statement != nullptr);

    int argsCount = sqlite3_bind_parameter_count(statement);

    if (argsCount != arguments.length(rt)) {
        std::abort(); // Unimplemented
    }

    for (int i = 0; i < argsCount; i++) {
        jsi::Value value = arguments.getValueAtIndex(rt, i);

        int bindResult;
        if (value.isNull()) {
            bindResult = sqlite3_bind_null(statement, i + 1);
        } else if (value.isString()) {
            // TODO: Check SQLITE_STATIC
            bindResult = sqlite3_bind_text(statement, i + 1, value.getString(rt).utf8(rt).c_str(), -1, SQLITE_TRANSIENT);
        } else if (value.isNumber()) {
            // TODO: Ints?
            bindResult = sqlite3_bind_double(statement, i + 1, value.getNumber());
        } else {
            std::abort(); // Unimplemented
        }

        if (bindResult != SQLITE_OK) {
            std::abort(); // Unimplemented
        }
    }

    int resultStep = sqlite3_step(statement); // todo: step_v2

    if (resultStep != SQLITE_DONE) {
        std::abort(); // Unimplemented
    }

    int resultFinalize = sqlite3_reset(statement);

    if (resultFinalize != SQLITE_OK) {
        std::abort(); // Unimplemented
    }
}

sqlite3_stmt* Database::executeQuery(jsi::Runtime& rt, std::string sql, jsi::Array& arguments) {
    sqlite3_stmt *statement = cachedStatements_[sql];
    // TODO: Do we need to reset cached statement before use?

    if (statement == nullptr) {
        int resultPrepare = sqlite3_prepare_v2(db_->sqlite, sql.c_str(), -1, &statement, nullptr);

        if (resultPrepare != SQLITE_OK) {
            std::abort(); // Unimplemented
        }
        cachedStatements_[sql] = statement;
    } else {
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
        if (value.isNull()) {
            bindResult = sqlite3_bind_null(statement, i + 1);
        } else if (value.isString()) {
            // TODO: Check SQLITE_STATIC
            bindResult = sqlite3_bind_text(statement, i + 1, value.getString(rt).utf8(rt).c_str(), -1, SQLITE_TRANSIENT);
        } else if (value.isNumber()) {
            // TODO: Ints?
            bindResult = sqlite3_bind_double(statement, i + 1, value.getNumber());
        } else {
            std::abort(); // Unimplemented
        }

        if (bindResult != SQLITE_OK) {
            std::abort(); // Unimplemented
        }
    }

    return statement;
}

jsi::Object Database::resultDictionary(jsi::Runtime &rt, sqlite3_stmt *statement) {
    jsi::Object dictionary(rt);

    for (int i = 0, len = sqlite3_column_count(statement); i < len; i++) {
        const char *column = sqlite3_column_name(statement, i);
        int valueType = sqlite3_column_type(statement, i);

        if (valueType == SQLITE_INTEGER) {
            dictionary.setProperty(rt, column, jsi::Value(sqlite3_column_int(statement, i)));
        } else if (valueType == SQLITE_FLOAT) {
            dictionary.setProperty(rt, column, jsi::Value(sqlite3_column_double(statement, i)));
        } else if (valueType == SQLITE_TEXT) {
            const char *text = (const char *) sqlite3_column_text(statement, i);

            if (!text) {
                dictionary.setProperty(rt, column, jsi::Value::null());
            }

            dictionary.setProperty(rt, column, jsi::String::createFromAscii(rt, text));
        } else if (valueType == SQLITE_NULL) {
            dictionary.setProperty(rt, column, jsi::Value::null());
        } else {
            // SQLITE_BLOB, ??? future/extension types?
            std::abort(); // Unimplemented
        }
    }

    return dictionary;
}

jsi::Value Database::find(jsi::Runtime& rt, jsi::String& tableName, jsi::String& id) {
    // TODO: caching
    //    guard !isCached(table, id) else {
    //        return id
    //    }

    auto args = jsi::Array::createWithElements(rt, id);
    sqlite3_stmt *statement = executeQuery(rt, "select * from " + tableName.utf8(rt) + " where id == ? limit 1", args);

    int resultStep = sqlite3_step(statement); // todo: step_v2

    if (resultStep == SQLITE_DONE) {
        return jsi::Value::null();
    }

    if (resultStep != SQLITE_ROW) {
        std::abort(); // Unimplemented
    }

    return resultDictionary(rt, statement);

    // TODO: caching
//    markAsCached(table, id)
}

jsi::Value Database::query(jsi::Runtime& rt, jsi::String& tableName, jsi::String& sql, jsi::Array& arguments) {
    sqlite3_stmt *statement = executeQuery(rt, sql.utf8(rt), arguments);

    jsi::Array records(rt, 0);

    for (size_t i = 0; true; i++) {
        int resultStep = sqlite3_step(statement); // todo: step_v2

        if (resultStep == SQLITE_DONE) {
            break;
        }

        if (resultStep != SQLITE_ROW) {
            std::abort(); // Unimplemented
        }

        // TODO: Caching
        jsi::Object record = resultDictionary(rt, statement);

        records.setValueAtIndex(rt, i, record);
    }

    return records;
}

jsi::Value Database::count(jsi::Runtime& rt, jsi::String& sql, jsi::Array& arguments) {
    sqlite3_stmt *statement = executeQuery(rt, sql.utf8(rt), arguments);

    int resultStep = sqlite3_step(statement); // todo: step_v2

    if (resultStep != SQLITE_ROW) {
        std::abort(); // Unimplemented
    }

    // sanity check - do we even need it? maybe debug only?
    if (sqlite3_data_count(statement) != 1) {
        std::abort();
    }

    int count = sqlite3_column_int(statement, 0);
    return jsi::Value(count);
}

void Database::batch(jsi::Runtime& rt, jsi::Array& operations) {
    sqlite3_exec(db_->sqlite, "begin exclusive transaction", nullptr, nullptr, nullptr); // TODO: clean up

    size_t operationsCount = operations.length(rt);
    for (size_t i = 0; i < operationsCount; i++) {
        jsi::Array operation = operations.getValueAtIndex(rt, i).getObject(rt).getArray(rt);
        std::string type = operation.getValueAtIndex(rt, 0).getString(rt).utf8(rt);
        const jsi::String table = operation.getValueAtIndex(rt, 1).getString(rt);

        if (type == "create") {
//            TODO: Record caching
//            std::string id = operation.getValueAtIndex(rt, 2).getString(rt).utf8(rt);
            jsi::String sql = operation.getValueAtIndex(rt, 3).getString(rt);
            jsi::Array arguments = operation.getValueAtIndex(rt, 4).getObject(rt).getArray(rt);

            executeUpdate(rt, sql.utf8(rt), arguments);
        } else if (type == "execute") {
            jsi::String sql = operation.getValueAtIndex(rt, 2).getString(rt);
            jsi::Array arguments = operation.getValueAtIndex(rt, 3).getObject(rt).getArray(rt);

            executeUpdate(rt, sql.utf8(rt), arguments);
        } else if (type == "markAsDeleted") {
//            TODO: Record caching
            const jsi::String id = operation.getValueAtIndex(rt, 2).getString(rt);
            auto args = jsi::Array::createWithElements(rt, id);
            executeUpdate(rt, "update " + table.utf8(rt) + " set _status='deleted' where id == ?", args);

        } else if (type == "destroyPermanently") {
//            TODO: Record caching
            const jsi::String id = operation.getValueAtIndex(rt, 2).getString(rt);
            auto args = jsi::Array::createWithElements(rt, id);

            // TODO: What's the behavior if nothing got deleted?
            executeUpdate(rt, "delete from " + table.utf8(rt) + " where id == ?", args);
        } else {
            throw jsi::JSError(rt, "Invalid operation type");
        }
    }

    sqlite3_exec(db_->sqlite, "commit transaction", nullptr, nullptr, nullptr); // TODO: clean up
}

jsi::Array Database::getDeletedRecords(jsi::Runtime& rt, jsi::String& tableName) {
    auto args = jsi::Array::createWithElements(rt);
    sqlite3_stmt *statement = executeQuery(rt, "select id from " + tableName.utf8(rt) + " where _status='deleted'", args);

    jsi::Array records(rt, 0);

    for (size_t i = 0; true; i++) {
        int resultStep = sqlite3_step(statement); // todo: step_v2

        if (resultStep == SQLITE_DONE) {
            break;
        }

        if (resultStep != SQLITE_ROW) {
            std::abort(); // Unimplemented
        }

        // sanity check - do we even need it? maybe debug only?
        if (sqlite3_data_count(statement) != 1) {
            std::abort();
        }

        const char *text = (const char *) sqlite3_column_text(statement, 0);

        if (!text) {
            std::abort(); // Unimplemented
        }

        jsi::String id = jsi::String::createFromAscii(rt, text);
        records.setValueAtIndex(rt, i, id);
    }

    return records;
}

void Database::destroyDeletedRecords(jsi::Runtime& rt, jsi::String& tableName, jsi::Array& recordIds) {
    sqlite3_exec(db_->sqlite, "begin exclusive transaction", nullptr, nullptr, nullptr); // TODO: clean up

    // TODO: Maybe it's faster & easier to do it in one query?
    std::string sql = "delete from " + tableName.utf8(rt) + " where id == ?";

    for (size_t i = 0, len = recordIds.size(rt); i < len; i++) {
        // TODO: What's the behavior if record doesn't exist or isn't actually deleted?
        jsi::String id = recordIds.getValueAtIndex(rt, i).getString(rt);
        auto args = jsi::Array::createWithElements(rt, id);
        executeUpdate(rt, sql, args);
    }

    sqlite3_exec(db_->sqlite, "commit transaction", nullptr, nullptr, nullptr); // TODO: clean up
}

void Database::unsafeResetDatabase(jsi::Runtime& rt, jsi::String& schema, jsi::Value& schemaVersion) {
    throw jsi::JSError(rt, "Unimplemented");
}

jsi::Value Database::getLocal(jsi::Runtime& rt, jsi::String& key) {
    auto args = jsi::Array::createWithElements(rt, key);
    sqlite3_stmt *statement = executeQuery(rt, "select value from local_storage where key = ?", args);

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

    const char *text = (const char *) sqlite3_column_text(statement, 0);

    if (!text) {
        return jsi::Value::null();
    }

    return std::move(jsi::String::createFromAscii(rt, text));
}

void Database::setLocal(jsi::Runtime& rt, jsi::String& key, jsi::String& value) {
    auto args = jsi::Array::createWithElements(rt, key, value);
    executeUpdate(rt, "insert or replace into local_storage (key, value) values (?, ?)", args);
}

void Database::removeLocal(jsi::Runtime& rt, jsi::String& key) {
    auto args = jsi::Array::createWithElements(rt, key);
    executeUpdate(rt, "delete from local_storage where key == ?", args);
}

} // namespace watermelondb
