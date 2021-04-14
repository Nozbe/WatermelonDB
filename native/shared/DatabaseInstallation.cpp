#include "Database.h"
#include "DatabasePlatform.h"
#include "JSLockPerfHack.h"

namespace watermelondb {

using platform::consoleError;
using platform::consoleLog;

void assertCount(size_t count, size_t expected, std::string name) {
    if (count != expected) {
        std::string error = name + " takes " + std::to_string(expected) + " arguments";
        #ifdef ANDROID
        consoleError(error);
        std::abort();
        #else
        throw std::invalid_argument(error);
        #endif
    }
}

jsi::Value makeError(facebook::jsi::Runtime &rt, const std::string &desc) {
    return rt.global().getPropertyAsFunction(rt, "Error").call(rt, desc);
}

jsi::Value runBlock(facebook::jsi::Runtime &rt, std::function<jsi::Value(void)> block) {
    jsi::Value retValue;
    watermelonCallWithJSCLockHolder(rt, [&]() {
        // NOTE: C++ Exceptions don't work correctly on Android -- most likely due to the fact that
        // we don't share the C++ stdlib with React Native targets, which means that the executor
        // doesn't know how to catch our exceptions to turn them into JS errors. As a workaround,
        // we catch those ourselves and return JS Errors instead of throwing them in JS VM.
        // See also:
        // https://github.com/facebook/hermes/issues/422 - REA also catches all exceptions in C++
        //    but then passes them to Java world via JNI
        // https://github.com/facebook/hermes/issues/298#issuecomment-661352050
        // https://github.com/facebook/react-native/issues/29558
        #ifdef ANDROID
        try {
            retValue = block();
        } catch (const jsi::JSError &error) {
            retValue = makeError(rt, error.getMessage());
        } catch (const std::exception &ex) {
            std::string exceptionString("Exception in HostFunction: ");
            exceptionString += ex.what();
            retValue = makeError(rt, exceptionString);
        } catch (...) {
            std::string exceptionString("Exception in HostFunction: <unknown>");
            retValue = makeError(rt, exceptionString);
        }
        #else
        retValue = block();
        #endif
    });
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
                return makeError(rt, ex.what());
            }

            database->initialized_ = true;
            return jsi::Value::undefined();
        });
        createMethod(rt, adapter, "find", 2, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String tableName = args[0].getString(rt);
            jsi::String id = args[1].getString(rt);

            return runBlock(rt, [&]() { return database->find(tableName, id); });
        });
        createMethod(rt, adapter, "query", 3, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String tableName = args[0].getString(rt);
            jsi::String sql = args[1].getString(rt);
            jsi::Array arguments = args[2].getObject(rt).getArray(rt);

            return runBlock(rt, [&]() { return database->query(tableName, sql, arguments); });
        });
        createMethod(rt, adapter, "count", 2, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String sql = args[0].getString(rt);
            jsi::Array arguments = args[1].getObject(rt).getArray(rt);

            return runBlock(rt, [&]() { return database->count(sql, arguments); });
        });
        createMethod(rt, adapter, "batch", 1, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::Array operations = args[0].getObject(rt).getArray(rt);

            return runBlock(rt, [&]() {
                database->batch(operations);
                return jsi::Value::undefined();
            });
        });
        createMethod(rt, adapter, "getLocal", 1, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String key = args[0].getString(rt);

            return runBlock(rt, [&]() { return database->getLocal(key); });
        });
        createMethod(rt, adapter, "setLocal", 2, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String key = args[0].getString(rt);
            jsi::String value = args[1].getString(rt);

            return runBlock(rt, [&]() {
                database->setLocal(key, value);
                return jsi::Value::undefined();
            });
        });
        createMethod(rt, adapter, "removeLocal", 1, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String key = args[0].getString(rt);

            return runBlock(rt, [&]() {
                database->removeLocal(key);
                return jsi::Value::undefined();
            });
        });
        createMethod(rt, adapter, "getDeletedRecords", 1, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String tableName = args[0].getString(rt);

            return runBlock(rt, [&]() { return database->getDeletedRecords(tableName); });
        });
        createMethod(rt, adapter, "destroyDeletedRecords", 2, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String tableName = args[0].getString(rt);
            jsi::Array recordIds = args[1].getObject(rt).getArray(rt);

            return runBlock(rt, [&]() {
                database->destroyDeletedRecords(tableName, recordIds);
                return jsi::Value::undefined();
            });
        });
        createMethod(rt, adapter, "unsafeResetDatabase", 2, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String schema = args[0].getString(rt);
            int schemaVersion = (int)args[1].getNumber();

            return runBlock(rt, [&]() {
                try {
                    database->unsafeResetDatabase(schema, schemaVersion);
                    return jsi::Value::undefined();
                } catch (const std::exception &ex) {
                    consoleError("Failed to reset database correctly - " + std::string(ex.what()));
                    // Partially reset database is likely corrupted, so it's probably less bad to crash
                    std::abort();
                }
            });
        });

        return adapter;
    });

    // TODO: Use the onMemoryAlert hook!
}


} // namespace watermelondb

