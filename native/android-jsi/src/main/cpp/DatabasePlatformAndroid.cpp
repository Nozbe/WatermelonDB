#include <android/log.h>
#include <mutex>
#include <unordered_map>
#include <sqlite3.h>

#include "DatabasePlatform.h"
#include "DatabasePlatformAndroid.h"

#define LOG_TAG "watermelondb.jsi"
#define SQLITE_LOG_TAG "watermelondb.sqlite"

namespace watermelondb {
namespace platform {

void consoleLog(std::string message) {
    __android_log_print(ANDROID_LOG_INFO, LOG_TAG, "%s\n", message.c_str());
}

void consoleError(std::string message) {
    __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, "%s\n", message.c_str());
}

jint verbose_level;

bool isVerboseLogEnabled() {
    // TODO: Available since API level 30
    // return __android_log_is_loggable(verbose_level, SQLITE_LOG_TAG, ANDROID_LOG_INFO);
    return false;
}

// Based on https://github.com/aosp-mirror/platform_frameworks_base/blob/6bebb8418ceecf44d2af40033870f3aabacfe36e/core/jni/android_database_SQLiteGlobal.cpp#L38
static void sqliteLogCallback(void *data, int err, const char *message) {
    bool isVerbose = !!data;
    int errType = err & 255;
    if (errType == 0 || errType == SQLITE_CONSTRAINT || errType == SQLITE_SCHEMA || errType == SQLITE_NOTICE ||
        err == SQLITE_WARNING_AUTOINDEX) {
        if (isVerbose) {
            __android_log_print(ANDROID_LOG_VERBOSE, SQLITE_LOG_TAG, "(%d) %s\n", err, message);
        }
    } else if (errType == SQLITE_WARNING) {
        __android_log_print(ANDROID_LOG_WARN, SQLITE_LOG_TAG, "(%d) %s\n", err, message);
    } else {
        __android_log_print(ANDROID_LOG_ERROR, SQLITE_LOG_TAG, "(%d) %s\n", err, message);
    }
}

std::once_flag sqliteInitialization;

void initializeSqlite() {
    std::call_once(sqliteInitialization, []() {
        // Redirect sqlite messages to Android log
        if (sqlite3_config(SQLITE_CONFIG_LOG, &sqliteLogCallback, isVerboseLogEnabled()) != SQLITE_OK) {
            consoleError("Failed to configure SQLite to redirect messages to Android log");
        }

        // Enable file URI syntax https://www.sqlite.org/uri.html (e.g. ?mode=memory&cache=shared)
        if (sqlite3_config(SQLITE_CONFIG_URI, 1) != SQLITE_OK) {
            consoleError("Failed to configure SQLite to support file URI syntax - shared cache will not work");
        }

        // FIXME: I don't quite understand why, but without this, JSI Watermelon crashes on Android/Hermes
        // on app reload, like so:
        //   abort 0x00007d0bd27cff2f
        //   __fortify_fatal(char const*, ...) 0x00007d0bd27d20c1
        //   HandleUsingDestroyedMutex(pthread_mutex_t*, char const*) 0x00007d0bd283b020
        //   pthread_mutex_lock 0x00007d0bd283aef4
        //   pthreadMutexEnter sqlite3.c:26320
        //   sqlite3_mutex_enter sqlite3.c:25775
        //   sqlite3_next_stmt sqlite3.c:84221
        //   watermelondb::SqliteDb::~SqliteDb() Sqlite.cpp:57
        // It sounds like the unix thread on which we're running is already destroyed, but AFAIU
        // destructors in jsi-managed objects should be safe in this respect...
        // It should be safe to disable sqlite3's threadsafety since we're only using it singlethreaded anyway...
        if (sqlite3_config(SQLITE_CONFIG_SINGLETHREAD) != SQLITE_OK) {
            consoleError("Failed to configure SQLite to SQLITE_CONFIG_SINGLETHREAD");
        }

        // sqlite should do its best to stay <8MB of heap allocations
        // 8MB is what android uses by default:
        // https://github.com/aosp-mirror/platform_frameworks_base/blob/6bebb8418ceecf44d2af40033870f3aabacfe36e/core/jni/android_database_SQLiteGlobal.cpp#L68
        sqlite3_soft_heap_limit(8 * 1024 * 1024);

        if (sqlite3_initialize() != SQLITE_OK) {
            consoleError("Failed to initialize sqlite - this probably means sqlite was already initialized");
        }
    });
}

static JavaVM *jvm;

void configureJNI(JNIEnv *env) {
    assert(env);
    if (env->GetJavaVM(&jvm) != JNI_OK) {
        consoleError("Could not initialize WatermelonDB JSI - cannot get JavaVM");
        std::abort();
    }
    assert(jvm);

    // // find magic constant needed for verbose logs
    // jclass logClass = env->FindClass("android/util/Log");
    // if (logClass == NULL) {
    //     throw std::runtime_error("Unable to find android/util/Log");
    // }
    // jfieldID logVerboseFieldId = env->GetStaticFieldID(logClass, "VERBOSE", "I");
    // if (logVerboseFieldId == NULL) {
    //     throw std::runtime_error("Unable to find android/util/Log's VERBOSE");
    // }
    // verbose_level = env->GetStaticIntField(logClass, logVerboseFieldId);
}

std::string resolveDatabasePath(std::string path) {
    JNIEnv *env;
    assert(jvm);
    if (jvm->AttachCurrentThread(&env, NULL) != JNI_OK) {
        throw std::runtime_error("Unable to resolve db path - JVM thread attach failed");
    }
    assert(env);

    jclass clazz = env->FindClass("com/nozbe/watermelondb/jsi/JSIInstaller");
    if (clazz == NULL) {
        throw std::runtime_error("Unable to resolve db path - missing JSIInstaller class");
    }
    jmethodID mid = env->GetStaticMethodID(clazz, "_resolveDatabasePath", "(Ljava/lang/String;)Ljava/lang/String;");
    if (mid == NULL) {
        throw std::runtime_error("Unable to resolve db path - missing Java _resolveDatabasePath method");
    }

    jobject jniPath = env->NewStringUTF(path.c_str());
    if (jniPath == NULL) {
        throw std::runtime_error("Unable to resolve db path - could not construct a Java string");
    }
    jstring jniResolvedPath = (jstring)env->CallStaticObjectMethod(clazz, mid, jniPath);
    if (env->ExceptionCheck()) {
        throw std::runtime_error("Unable to resolve db path - exception occured while resolving path");
    }
    const char *cResolvedPath = env->GetStringUTFChars(jniResolvedPath, 0);
    if (cResolvedPath == NULL) {
        throw std::runtime_error("Unable to resolve db path - failed to get path string");
    }
    std::string resolvedPath(cResolvedPath);
    env->ReleaseStringUTFChars(jniResolvedPath, cResolvedPath);
    return resolvedPath;
}

void deleteDatabaseFile(std::string path, bool warnIfDoesNotExist) {
    // TODO: Unimplemented
}

void onMemoryAlert(std::function<void(void)> callback) {
    // TODO: Unimplemented
    // NOTE: https://developer.android.com/reference/android/app/Application#onTrimMemory(int)
}

struct ProvidedSyncJson {
    jbyteArray array;
    jbyte *bytes;
    jsize length;
};

std::unordered_map<int, ProvidedSyncJson> providedSyncJsons;

void provideJson(int id, jbyteArray array) {
    JNIEnv *env;
    assert(jvm);
    if (jvm->AttachCurrentThread(&env, NULL) != JNI_OK) {
        return;
    }
    assert(env);

    if (providedSyncJsons.find(id) == providedSyncJsons.end()) {
        jclass exceptionClass = env->FindClass("java/lang/Exception");
        env->ThrowNew(exceptionClass, "sync json is already provided");
        return;
    }

    jbyte* bytes = env->GetByteArrayElements(array, NULL);
    jsize length = env->GetArrayLength(array);

    ProvidedSyncJson json = { array, bytes, length };
    providedSyncJsons[id] = json;
}

std::string_view getSyncJson(int id) {
    auto json = providedSyncJsons.at(id);
    std::string_view view((char *) json.bytes, json.length);
    return view;
}

void deleteSyncJson(int id) {
    JNIEnv *env;
    assert(jvm);
    if (jvm->AttachCurrentThread(&env, NULL) != JNI_OK) {
        throw std::runtime_error("JVM thread attach failed");
    }
    assert(env);

    auto json = providedSyncJsons.at(id);
    env->ReleaseByteArrayElements(json.array, json.bytes, JNI_ABORT);
    providedSyncJsons.erase(id);
}

} // namespace platform
} // namespace watermelondb
