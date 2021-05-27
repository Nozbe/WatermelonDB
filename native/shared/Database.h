#pragma once

#import <jsi/jsi.h>
#import <unordered_map>
#import <unordered_set>
#import <sqlite3.h>
#import "simdjson.h"
#include "vendor/rapidjson/writer.h"
#include "vendor/rapidjson/stringbuffer.h"

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
    jsi::Value queryAsArray(jsi::String &tableName, jsi::String &sql, jsi::Array &arguments);
    jsi::String queryJSON(jsi::String &tableName, jsi::String &sql, jsi::Array &arguments);
    jsi::String queryAsArrayJSON(jsi::String &tableName, jsi::String &sql, jsi::Array &arguments);
    jsi::Array queryIds(jsi::String &sql, jsi::Array &arguments);
    jsi::Array unsafeQueryRaw(jsi::String &sql, jsi::Array &arguments);
    jsi::Value count(jsi::String &sql, jsi::Array &arguments);
    void batch(jsi::Array &operations);
    void batchJSON(jsi::String &&json);
    void unsafeLoadFromSync(jsi::Object &changeSet, jsi::Object &schema);
    void unsafeLoadFromSyncJSON(std::string_view json, jsi::Object &schema);
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

    sqlite3_stmt* prepareQuery(std::string sql);
    void bindArgs(sqlite3_stmt *statement, jsi::Array &arguments);
    std::string bindArgs(sqlite3_stmt *statement, simdjson::ondemand::array &arguments);
    SqliteStatement executeQuery(std::string sql, jsi::Array &arguments);
    std::pair<sqlite3_stmt *, std::string> executeQuery(std::string sql, simdjson::ondemand::array &arguments);
    void executeUpdate(sqlite3_stmt *statement);
    void executeUpdate(std::string sql, jsi::Array &arguments);
    std::string executeUpdate(std::string sql, simdjson::ondemand::array &args);
    void executeUpdate(std::string sql);
    void executeMultiple(std::string sql);
    jsi::Object resultDictionary(sqlite3_stmt *statement);
    void resultJSON(sqlite3_stmt *statement, rapidjson::Writer<rapidjson::StringBuffer> &json);
    void resultArrayJSON(sqlite3_stmt *statement, rapidjson::Writer<rapidjson::StringBuffer> &json);
    jsi::Array resultArray(sqlite3_stmt *statement);
    jsi::Array resultColumns(sqlite3_stmt *statement);
    void resultColumnsJSON(sqlite3_stmt *statement, rapidjson::Writer<rapidjson::StringBuffer> &json);

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
