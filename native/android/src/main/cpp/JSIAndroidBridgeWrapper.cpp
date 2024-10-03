//
// Created by BuildOpsLA27 on 9/30/24.
//
#include "JSIAndroidBridgeWrapper.h"
#include "JSIUtils.h"

using namespace watermelondb;

namespace watermelondb {
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

        jmethodID execSqlQuerySynchronousMethod = env->GetMethodID(
                myNativeModuleClass,
                "execSqlQuerySynchronous",  // Method name in Kotlin
                "(ILjava/lang/String;Lcom/facebook/react/bridge/ReadableArray;)Lcom/facebook/react/bridge/WritableArray;"
        );

        jstring jQuery = env->NewStringUTF(queryStr.c_str());
        jobject jParams = convertJSIArrayToReadableArray(*runtime_, env, arguments);

        // Call the Kotlin instance method via JNI on `bridge_`
        jobject resultArray = env->CallObjectMethod(bridge_, execSqlQuerySynchronousMethod, jTag, jQuery, jParams);

        // Cleanup JNI references
        env->DeleteLocalRef(jQuery);
        env->DeleteLocalRef(jParams);

        return convertWritableArrayToJSIArray(*runtime_, env, resultArray);
    }

    jsi::Value JSIAndroidBridge::query(const jsi::Value &tag, const jsi::String &table, const jsi::String &query) {
        JNIEnv *env = getEnv();

        // Convert the jsi::Value arguments to std::string
        jint jTag = static_cast<jint>(tag.asNumber());

        auto tableStr = table.utf8(*runtime_);
        auto queryStr = query.utf8(*runtime_);

        // Convert the arguments to JNI types
        jclass myNativeModuleClass = env->GetObjectClass(bridge_);  // Get the class of the instance

        jmethodID querySynchronousMethod = env->GetMethodID(
                myNativeModuleClass, "querySynchronous", "(ILjava/lang/String;Ljava/lang/String;)Lcom/facebook/react/bridge/WritableArray;"
        );

        jstring jTable = env->NewStringUTF(tableStr.c_str());
        jstring jQuery = env->NewStringUTF(queryStr.c_str());

        // Call the Kotlin instance method via JNI on `bridge_`
        jobject resultArray = env->CallObjectMethod(bridge_, querySynchronousMethod, jTag, jTable, jQuery);

        // Cleanup JNI references
        env->DeleteLocalRef(jTable);
        env->DeleteLocalRef(jQuery);

        // Convert the result (jobject) to a JSI-compatible value
        return convertWritableArrayToJSIArray(*runtime_, env, resultArray);
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