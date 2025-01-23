//
// Created by BuildOpsLA27 on 9/30/24.
//
#include "JSIAndroidBridgeWrapper.h"
#include "DatabaseUtils.h"
#include <string>
#include <sqlite3.h>
#include <android/log.h>

#define LOG_TAG "watermelondb.jsi"

using namespace watermelondb;

struct SQLiteConnection {
    sqlite3* const db;
    const int openFlags;
    char* path;
    char* label;

    volatile bool canceled;

    SQLiteConnection(sqlite3* db, int openFlags, const char* path_, const char* label_) :
            db(db), openFlags(openFlags), canceled(false) {
        path = strdup(path_);
        label = strdup(label_);
    }

    ~SQLiteConnection() {
        free(path);
        free(label);
    }
};

namespace watermelondb {
    namespace platform {
        void consoleLog(std::string message) {
            __android_log_print(ANDROID_LOG_INFO, LOG_TAG, "%s\n", message.c_str());
        }

        void consoleError(std::string message) {
            __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, "%s\n", message.c_str());
        }

        void initializeSqlite() {
            // Nothing to do
        }

        std::string resolveDatabasePath(std::string path) {
            return std::string();
        }
    }

    static JavaVM *jvm;

    JSIAndroidBridge::JSIAndroidBridge(jsi::Runtime *runtime, jobject bridge)
            : runtime_(runtime), bridge_(bridge) {
    }

    JSIAndroidBridge::~JSIAndroidBridge() {

    }

    JNIEnv* getEnv() {
        JNIEnv *env;

        assert(jvm);

        if (jvm->AttachCurrentThread(&env, NULL) != JNI_OK) {
            throw std::runtime_error("Unable to resolve db path - JVM thread attach failed");
        }

        assert(env);

        return env;
    }

    jsi::Value JSIAndroidBridge::execSqlQuery(const jsi::Value &tag, const jsi::String &sql, const jsi::Array &arguments) {
        JNIEnv *env = getEnv();
        jint jTag = static_cast<jint>(tag.asNumber());

        std::string queryStr = sql.utf8(*runtime_);

        jclass myNativeModuleClass = env->GetObjectClass(bridge_);  // 'bridge_' refers to your Kotlin/Java instance

        jmethodID getConnectionMethod = env->GetMethodID(
                myNativeModuleClass,
                "getSQLiteConnection",  // Method name in Kotlin
                "(I)J"
        );

        jmethodID releaseConnectionMethod = env->GetMethodID(
                myNativeModuleClass,
                "releaseSQLiteConnection",  // Method name in Kotlin
                "(I)V"
        );

        SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(env->CallLongMethod(bridge_, getConnectionMethod, jTag));

        sqlite3* db = connection->db;

        const std::lock_guard<std::mutex> lock(mutex_);

        auto stmt = getStmt(*runtime_, reinterpret_cast<sqlite3*>(db), sql.utf8(*runtime_), arguments);

        std::vector<jsi::Value> records = {};

        while (true) {
            if (getNextRowOrTrue(*runtime_, stmt)) {
                break;
            }

            jsi::Object record = resultDictionary(*runtime_, stmt);

            records.push_back(std::move(record));
        }

        env->CallVoidMethod(bridge_, releaseConnectionMethod, jTag);

        return arrayFromStd(*runtime_, records);
    }

    jsi::Value JSIAndroidBridge::query(const jsi::Value &tag, const jsi::String &table, const jsi::String &query) {
        JNIEnv *env = getEnv();

        // Convert the jsi::Value arguments to std::string
        jint jTag = static_cast<jint>(tag.asNumber());

        auto tableStr = table.utf8(*runtime_);
        auto queryStr = query.utf8(*runtime_);

        jclass myNativeModuleClass = env->GetObjectClass(bridge_);  // 'bridge_' refers to your Kotlin/Java instance

        jmethodID getConnectionMethod = env->GetMethodID(
                myNativeModuleClass,
                "getSQLiteConnection",  // Method name in Kotlin
                "(I)J"
        );

        jmethodID releaseConnectionMethod = env->GetMethodID(
                myNativeModuleClass,
                "releaseSQLiteConnection",  // Method name in Kotlin
                "(I)V"
        );

        SQLiteConnection* connection = reinterpret_cast<SQLiteConnection*>(env->CallLongMethod(bridge_, getConnectionMethod, jTag));

        sqlite3* db = connection->db;

        const std::lock_guard<std::mutex> lock(mutex_);

        auto stmt = getStmt(*runtime_, db, query.utf8(*runtime_), jsi::Array(*runtime_, 0));

        std::vector<jsi::Value> records = {};

        while (true) {
            if (getNextRowOrTrue(*runtime_, stmt)) {
                break;
            }

            assert(std::string(sqlite3_column_name(stmt, 0)) == "id");

            const char *id = (const char *)sqlite3_column_text(stmt, 0);

            if (!id) {
                throw jsi::JSError(*runtime_, "Failed to get ID of a record");
            }

            jstring jId = env->NewStringUTF(id);
            jstring jTable = env->NewStringUTF(tableStr.c_str());

            jmethodID isCachedMethod = env->GetMethodID(
                    myNativeModuleClass,
                    "isCached",  // Method name in Kotlin
                    "(ILjava/lang/String;Ljava/lang/String;)Z");

            bool isCached = env->CallBooleanMethod(bridge_, isCachedMethod, jTag, jTable, jId);

            if (isCached) {
                jsi::String jsiId = jsi::String::createFromAscii(*runtime_, id);
                records.push_back(std::move(jsiId));
            } else {
                jmethodID markAsCachedMethod = env->GetMethodID(
                        myNativeModuleClass,
                        "markAsCached",
                        "(ILjava/lang/String;Ljava/lang/String;)V");

                env->CallVoidMethod(bridge_, markAsCachedMethod, jTag, jTable, jId);
                jsi::Object record = resultDictionary(*runtime_, stmt);
                records.push_back(std::move(record));
            }

            env->DeleteLocalRef(jId);
            env->DeleteLocalRef(jTable);
        }

        env->CallVoidMethod(bridge_, releaseConnectionMethod, jTag);

        return arrayFromStd(*runtime_, records);
    }

    void JSIAndroidBridge::install(jsi::Runtime *runtime, jobject bridge) {
        auto androidBridge = std::make_shared<JSIAndroidBridge>(runtime, bridge);

        if (!runtime->global().hasProperty(*runtime, "WatermelonDB")) {
            jsi::Object watermelonDB = jsi::Object(*runtime);
            runtime->global().setProperty(*runtime, "WatermelonDB", std::move(watermelonDB));
        }

        auto query = jsi::Function::createFromHostFunction(
                *runtime,
                jsi::PropNameID::forAscii(*runtime, "query"),
                3,  // Number of arguments
                [androidBridge](jsi::Runtime &rt, const jsi::Value &thisValue, const jsi::Value *args, size_t count) -> jsi::Value {
                    if (count != 3) {
                        throw jsi::JSError(rt, "query requires 3 arguments (tag, table, query)");
                    }

                    return androidBridge->query(args[0], args[1].asString(rt), args[2].asString(rt));
                }
        );

        auto execQuery = jsi::Function::createFromHostFunction(
                *runtime,
                jsi::PropNameID::forAscii(*runtime, "query"),
                3,  // Number of arguments
                [androidBridge](jsi::Runtime &rt, const jsi::Value &thisValue, const jsi::Value *args, size_t count) -> jsi::Value {
                    if (count != 3) {
                        throw jsi::JSError(rt, "query requires 3 arguments (tag, table, query)");
                    }

                    return androidBridge->execSqlQuery(args[0], args[1].asString(rt), args[2].asObject(rt).asArray(rt));
                }
        );

        runtime->global()
                .getPropertyAsObject(*runtime, "WatermelonDB")
                .setProperty(*runtime, "execSqlQuery", std::move(execQuery));

        runtime->global()
                .getPropertyAsObject(*runtime, "WatermelonDB")
                .setProperty(*runtime, "query", std::move(query));
    }

    void configureJNI(JNIEnv *env) {
        assert(env);

        if (env->GetJavaVM(&jvm) != JNI_OK) {
            std::abort();
        }

        assert(jvm);
    }
}