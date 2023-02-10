#pragma once

#import <jsi/jsi.h>
#import <unordered_map>
#import <unordered_set>
#import <mutex>
#import <sqlite3.h>

// FIXME: Make these paths consistent across platforms
#ifdef ANDROID
#import <simdjson.h>
#else
// Does Xcode error on this line? You probably didn't include `simdjson` as a dependency in your Podfile.
#import <simdjson/simdjson.h>
#endif

#import "Sqlite.h"
#import "DatabasePlatform.h"

using namespace facebook;

namespace watermelondb {

class Database : public jsi::HostObject {
public:
    static void install(jsi::Runtime *runtime);
    Database(jsi::Runtime *runtime, std::string path, bool usesExclusiveLocking);
    ~Database();
    void destroy();

    jsi::Value find(jsi::String &tableName, jsi::String &id);
    jsi::Value query(jsi::String &tableName, jsi::String &sql, jsi::Array &arguments);
    jsi::Value queryAsArray(jsi::String &tableName, jsi::String &sql, jsi::Array &arguments);
    jsi::Array queryIds(jsi::String &sql, jsi::Array &arguments);
    jsi::Array unsafeQueryRaw(jsi::String &sql, jsi::Array &arguments);
    jsi::Value count(jsi::String &sql, jsi::Array &arguments);
    void batch(jsi::Array &operations);
    void batchJSON(jsi::String &&operationsJson);
    jsi::Value unsafeLoadFromSync(int jsonId, jsi::Object &schema, std::string preamble, std::string postamble);
    void unsafeResetDatabase(jsi::String &schema, int schemaVersion);
    jsi::Value getLocal(jsi::String &key);
    void executeMultiple(std::string sql);

private:
    bool initialized_;
    bool isDestroyed_;
    std::mutex mutex_;
    jsi::Runtime *runtime_; // TODO: std::shared_ptr would be better, but I don't know how to make it from void* in RCTCxxBridge
    std::unique_ptr<SqliteDb> db_;
    std::unordered_map<std::string, sqlite3_stmt *> cachedStatements_; // NOTE: may contain null pointers!
    std::unordered_set<std::string> cachedRecords_;

    jsi::Runtime &getRt();
    jsi::JSError dbError(std::string description);

    sqlite3_stmt* prepareQuery(std::string sql);
    void bindArgs(sqlite3_stmt *statement, jsi::Array &arguments);
    std::string bindArgsAndReturnId(sqlite3_stmt *statement, simdjson::ondemand::array &args);
    SqliteStatement executeQuery(std::string sql, jsi::Array &arguments);
    void executeUpdate(sqlite3_stmt *statement);
    void executeUpdate(std::string sql, jsi::Array &arguments);
    void executeUpdate(std::string sql);
    void getRow(sqlite3_stmt *stmt);
    bool getNextRowOrTrue(sqlite3_stmt *stmt);
    jsi::Object resultDictionary(sqlite3_stmt *statement);
    jsi::Array resultArray(sqlite3_stmt *statement);
    jsi::Array resultColumns(sqlite3_stmt *statement);
    jsi::Array arrayFromStd(std::vector<jsi::Value> &vector);

    void beginTransaction();
    void commit();
    void rollback();

    int getUserVersion();
    void setUserVersion(int newVersion);
    void migrate(jsi::String &migrationSql, int fromVersion, int toVersion);

    bool isCached(std::string cacheKey);
    void markAsCached(std::string cacheKey);
    void removeFromCache(std::string cacheKey);
};

inline std::string cacheKey(std::string tableName, std::string recordId) {
    return tableName + "$" + recordId; // NOTE: safe as long as table names cannot contain $ sign
}

} // namespace watermelondb
