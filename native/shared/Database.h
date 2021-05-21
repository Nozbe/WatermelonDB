#pragma once

#import <jsi/jsi.h>
#import <unordered_map>
#import <unordered_set>
#import <sqlite3.h>

#import "Sqlite.h"

using namespace facebook;

namespace watermelondb {

class Database : public jsi::HostObject {
    public:
    static void install(jsi::Runtime *runtime);
    Database(jsi::Runtime *runtime, std::string path);
    ~Database();

    jsi::Value find(jsi::String &tableName, jsi::String &id);
    jsi::Value query(jsi::String &tableName, jsi::String &sql, jsi::Array &arguments);
    jsi::Array queryIds(jsi::String &sql, jsi::Array &arguments);
    jsi::Value count(jsi::String &sql, jsi::Array &arguments);
    void batch(jsi::Array &operations);
    void destroyDeletedRecords(jsi::String &tableName, jsi::Array &recordIds);
    void unsafeResetDatabase(jsi::String &schema, int schemaVersion);
    jsi::Value getLocal(jsi::String &key);

    private:
    bool initialized_;
    jsi::Runtime *runtime_; // TODO: std::shared_ptr would be better, but I don't know how to make it from void* in RCTCxxBridge
    std::unique_ptr<SqliteDb> db_;
    std::unordered_map<std::string, sqlite3_stmt *> cachedStatements_; // NOTE: may contain null pointers!
    std::unordered_set<std::string> cachedRecords_;

    jsi::Runtime &getRt();
    jsi::JSError dbError(std::string description);

    SqliteStatement executeQuery(std::string sql, jsi::Array &arguments);
    void executeUpdate(std::string sql, jsi::Array &arguments);
    void executeUpdate(std::string sql);
    void executeMultiple(std::string sql);
    jsi::Object resultDictionary(sqlite3_stmt *statement);

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

} // namespace watermelondb
