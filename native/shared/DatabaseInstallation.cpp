#include "Database.h"
#include "DatabasePlatform.h"
#include "JSLockPerfHack.h"

namespace watermelondb {

using platform::consoleError;
using platform::consoleLog;

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

void createMethod(jsi::Runtime &runtime, jsi::Object &object, const char *methodName, unsigned int argCount, jsiFunction func) {
    jsi::PropNameID name = jsi::PropNameID::forAscii(runtime, methodName);
    jsi::Function function = jsi::Function::createFromHostFunction(runtime, name, argCount, [methodName, argCount, func]
                                                                   (jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args, size_t count) {
        if (count != argCount) {
            std::string error = std::string(methodName) + " takes " + std::to_string(argCount) + " arguments";
            #ifdef ANDROID
            consoleError(error);
            std::abort();
            #else
            throw std::invalid_argument(error);
            #endif
        }
        return runBlock(rt, [&]() {
            return func(rt, args);
        });
    });
    object.setProperty(runtime, name, function);
}

void Database::install(jsi::Runtime *runtime) {
    jsi::Runtime &rt = *runtime;
    auto globalObject = rt.global();
    createMethod(rt, globalObject, "nativeWatermelonCreateAdapter", 2, [runtime](jsi::Runtime &rt, const jsi::Value *args) {
        std::string dbPath = args[0].getString(rt).utf8(rt);
        bool usesExclusiveLocking = args[1].getBool();

        jsi::Object adapter(rt);

        std::shared_ptr<Database> database = std::make_shared<Database>(runtime, dbPath, usesExclusiveLocking);
        adapter.setProperty(rt, "database", jsi::Object::createFromHostObject(rt, database));

        // FIXME: Important hack!
        // Without any hacks, JSI Watermelon crashes on Android/Hermes on app reload in development:
        // (This doesn't happen on iOS/JSC)
        //   abort 0x00007d0bd27cff2f
        //   __fortify_fatal(char const*, ...) 0x00007d0bd27d20c1
        //   HandleUsingDestroyedMutex(pthread_mutex_t*, char const*) 0x00007d0bd283b020
        //   pthread_mutex_lock 0x00007d0bd283aef4
        //   pthreadMutexEnter sqlite3.c:26320
        //   sqlite3_mutex_enter sqlite3.c:25775
        //   sqlite3_next_stmt sqlite3.c:84221
        //   watermelondb::SqliteDb::~SqliteDb() Sqlite.cpp:57
        // It appears that the Unix thread on which Database is set up is already destroyed by the
        // time destructor is called. AFAIU destructors on objects that are managed by JSI runtime
        // *should* be safe in this respect, but maybe they're not/there's a bug...
        //
        // For future debuggers, the flow goes like this:
        //  - ReactInstanceManager.runCreateReactContextOnNewThread()
        //       this sets up new instance
        //  - ReactInstanceManager.tearDownReactContext()
        //  - ReactContext.destroy()
        //  - CatalystInstanceImpl.destroy()
        //       this notifies listeners that the app is about to be destroyed
        //  - mHybridData.resetNative()
        //  - ~CatalystInstanceImpl()
        //  - ~Instance()
        //  - NativeToJSBridge.destroy()
        //  - m_executor = nullptr
        //  - ~Runtime()
        //  - ...
        //  - ~Database()
        //
        // First attempt to work around this issue was by disabling sqlite3's threadsafety (which caused
        // pthread apis to be called, leading to a crash), since we're only using it from one thread
        // but predictably that caused new issues.
        // When using headless JS, this issue would occur:
        //    Failed to get a row for query - sqlite error 11 (database disk image is malformed)
        // (Not exactly sure why, seems like headless JS reuses the same catalyst instance...)
        //
        // Current workaround is to tap into CatalystInstanceImpl.destroy() to destroy the database
        // before it's destructed via normal C++ rules. There's no clean API for our JSI setup, so
        // we route via NativeModuleRegistry onCatalystInstanceDestroy -> DatabaseBridge ->
        // WatermelonJSI via reflection (and switch to the currect thread - important!) and then to
        // individual Database objects via this listener callback. It's ugly, but should work.
        //
        // 2023 update: Check if the above is still true, given https://github.com/Nozbe/WatermelonDB/issues/1474
        // showed that the true cause of the pthread_mutex_lock crash is something else.
        // On the other hand, it's still true that invalidation happens asynchronously and could happen
        // after new bridge is already set up, which could cause locking issues (and a case was found on iOS where
        // this does happen)
        std::weak_ptr<Database> weakDatabase = database;
        platform::onDestroy([weakDatabase]() {
            if (auto databaseToDestroy = weakDatabase.lock()) {
                databaseToDestroy->destroy();
            }
        });

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
            return database->find(tableName, id);
        });
        createMethod(rt, adapter, "query", 3, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String tableName = args[0].getString(rt);
            jsi::String sql = args[1].getString(rt);
            jsi::Array arguments = args[2].getObject(rt).getArray(rt);
            return database->query(tableName, sql, arguments);
        });
        createMethod(rt, adapter, "queryAsArray", 3, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String tableName = args[0].getString(rt);
            jsi::String sql = args[1].getString(rt);
            jsi::Array arguments = args[2].getObject(rt).getArray(rt);
            return database->queryAsArray(tableName, sql, arguments);
        });
        createMethod(rt, adapter, "queryIds", 2, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String sql = args[0].getString(rt);
            jsi::Array arguments = args[1].getObject(rt).getArray(rt);
            return database->queryIds(sql, arguments);
        });
        createMethod(rt, adapter, "unsafeQueryRaw", 2, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String sql = args[0].getString(rt);
            jsi::Array arguments = args[1].getObject(rt).getArray(rt);
            return database->unsafeQueryRaw(sql, arguments);
        });
        createMethod(rt, adapter, "count", 2, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String sql = args[0].getString(rt);
            jsi::Array arguments = args[1].getObject(rt).getArray(rt);
            return database->count(sql, arguments);
        });
        createMethod(rt, adapter, "batch", 1, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::Array operations = args[0].getObject(rt).getArray(rt);
            database->batch(operations);
            return jsi::Value::undefined();
        });
        createMethod(rt, adapter, "batchJSON", 1, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            database->batchJSON(args[0].getString(rt));
            return jsi::Value::undefined();
        });
        createMethod(rt, adapter, "getLocal", 1, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String key = args[0].getString(rt);
            return database->getLocal(key);
        });
        createMethod(rt, adapter, "unsafeLoadFromSync", 4, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            auto jsonId = (int) args[0].getNumber();
            auto schema = args[1].getObject(rt);
            auto preamble = args[2].getString(rt).utf8(rt);
            auto postamble = args[3].getString(rt).utf8(rt);
            return database->unsafeLoadFromSync(jsonId, schema, preamble, postamble);
        });
        createMethod(rt, adapter, "unsafeExecuteMultiple", 1, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            auto sqlString = args[0].getString(rt).utf8(rt);
            database->executeMultiple(sqlString);
            return jsi::Value::undefined();
        });
        createMethod(rt, adapter, "unsafeResetDatabase", 2, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String schema = args[0].getString(rt);
            int schemaVersion = (int)args[1].getNumber();

            try {
                database->unsafeResetDatabase(schema, schemaVersion);
                return jsi::Value::undefined();
            } catch (const std::exception &ex) {
                consoleError("Failed to reset database correctly - " + std::string(ex.what()));
                // Partially reset database is likely corrupted, so it's probably less bad to crash
                std::abort();
            }
        });
        createMethod(rt, adapter, "unsafeClose", 0, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            database->destroy();
            database->initialized_ = false;
            return jsi::Value::undefined();
        });

        return adapter;
    });

    // TODO: Use the onMemoryAlert hook!
}


} // namespace watermelondb

