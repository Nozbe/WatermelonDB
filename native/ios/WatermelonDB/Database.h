#pragma once

#import <jsi/jsi.h>
#import <map>
#import <set>
#import <sqlite3.h>

using namespace facebook;

namespace watermelondb {

// Lightweight wrapper for handling sqlite3 lifetime
class SqliteDb {
    public:
    SqliteDb(std::string path);
    ~SqliteDb();

    sqlite3 *sqlite;

    SqliteDb &operator=(const SqliteDb &) = delete;
    SqliteDb(const SqliteDb &) = delete;
};

class SqliteStatement {
public:
    SqliteStatement(sqlite3_stmt *statement);
    ~SqliteStatement();

    sqlite3_stmt *stmt;

    void reset();
};

class Database : public jsi::HostObject {
    public:
    static void install(jsi::Runtime *runtime);
    Database(jsi::Runtime *runtime, std::string path);
    ~Database();

    jsi::Value find(jsi::String &tableName, jsi::String &id);
    jsi::Value query(jsi::String &tableName, jsi::String &sql, jsi::Array &arguments);
    jsi::Value count(jsi::String &sql, jsi::Array &arguments);
    void batch(jsi::Array &operations);
    jsi::Array getDeletedRecords(jsi::String &tableName);
    void destroyDeletedRecords(jsi::String &tableName, jsi::Array &recordIds);
    void unsafeResetDatabase(jsi::String &schema, int schemaVersion);
    jsi::Value getLocal(jsi::String &key);
    void setLocal(jsi::String &key, jsi::String &value);
    void removeLocal(jsi::String &key);

    private:
    bool initialized_;
    jsi::Runtime *runtime_; // TODO: std::shared_ptr would be better, but I don't know how to make it from void* in RCTCxxBridge
    std::unique_ptr<SqliteDb> db_;
    std::map<std::string, sqlite3_stmt *> cachedStatements_; // NOTE: may contain null pointers!
    std::set<std::string> cachedRecords_;

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

    bool isCached(std::string tableName, std::string recordId);
    void markAsCached(std::string tableName, std::string recordId);
    void removeFromCache(std::string tableName, std::string recordId);
};

} // namespace watermelondb
