#include "Database.h"
#include "JSLockPerfHack.h"
#include <pmmintrin.h>

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

void Database::executeQuery(jsi::Runtime& rt, std::string sql, jsi::Array& arguments) {
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
}

jsi::Value Database::find(jsi::Runtime& rt, jsi::String& tableName, jsi::String& id) {
    throw jsi::JSError(rt, "Unimplemented");

//    guard !isCached(table, id) else {
//        return id
//    }
//
//    let results = try database.queryRaw("select * from \(table) where id == ? limit 1", [id])
//
//    guard let record = results.next() else {
//        return nil
//    }
//
//    markAsCached(table, id)
//    return record.resultDictionary!
}

jsi::Value Database::query(jsi::Runtime& rt, jsi::String& tableName, jsi::String& sql, jsi::Array& arguments) {
    throw jsi::JSError(rt, "Unimplemented");

//    return try database.queryRaw(query).map { row in
//        let id = row.string(forColumn: "id")!
//
//        if isCached(table, id) {
//            return id
//        } else {
//            markAsCached(table, id)
//            return row.resultDictionary!
//        }
//    }
}

jsi::Value Database::count(jsi::Runtime& rt, jsi::String& sql, jsi::Array& arguments) {
    throw jsi::JSError(rt, "Unimplemented");
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
            auto args = jsi::Array::createWithElements(rt, table, id);
            executeUpdate(rt, "update ? set _status='deleted' where id == ?", args);

        } else if (type == "destroyPermanently") {
//            TODO: Record caching
            const jsi::String id = operation.getValueAtIndex(rt, 2).getString(rt);
            auto args = jsi::Array::createWithElements(rt, table, id);

            // TODO: What's the behavior if nothing got deleted?
            executeUpdate(rt, "delete from ? where id == ?", args);
        } else {
            throw jsi::JSError(rt, "Invalid operation type");
        }
    }

    sqlite3_exec(db_->sqlite, "commit transaction", nullptr, nullptr, nullptr); // TODO: clean up
}

jsi::Array Database::getDeletedRecords(jsi::Runtime& rt, jsi::String& tableName) {
    throw jsi::JSError(rt, "Unimplemented");
//    return try database.queryRaw("select id from \(table) where _status='deleted'").map { row in
//        row.string(forColumn: "id")!
//    }
}

void Database::destroyDeletedRecords(jsi::Runtime& rt, jsi::String& tableName, jsi::Array& recordIds) {
    throw jsi::JSError(rt, "Unimplemented");
//    // TODO: What's the behavior if record doesn't exist or isn't actually deleted?
//    let recordIds = records.map { id in "'\(id)'" }.joined(separator: ",")
//    try database.execute("delete from \(table) where id in (\(recordIds))")
}

void Database::unsafeResetDatabase(jsi::Runtime& rt, jsi::String& schema, jsi::Value& schemaVersion) {
    throw jsi::JSError(rt, "Unimplemented");
}

jsi::String Database::getLocal(jsi::Runtime& rt, jsi::String& key) {
    throw jsi::JSError(rt, "Unimplemented");
//    let results = try database.queryRaw("select value from local_storage where key = ?", [key])
//
//    guard let record = results.next() else {
//        return nil
//    }
//
//    return record.string(forColumn: "value")!
}

void Database::setValue(jsi::Runtime& rt, jsi::String& key, jsi::String& value) {
    auto args = jsi::Array::createWithElements(rt, key, value);
    executeUpdate(rt, "insert or replace into local_storage (key, value) values (?, ?)", args);
}

void Database::removeLocal(jsi::Runtime& rt, jsi::String& key) {
    auto args = jsi::Array::createWithElements(rt, key);
    executeUpdate(rt, "delete from local_storage where key == ?", args);
}

} // namespace watermelondb
