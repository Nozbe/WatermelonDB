#pragma once

#import <jsi/jsi.h>
#import <sqlite3.h>
#import <map>

using namespace facebook;

namespace watermelondb
{

// Lightweight wrapper for handling sqlite3 lifetime
class SqliteDb
{
public:
    SqliteDb(std::string path);
    ~SqliteDb();

    sqlite3 *sqlite;

    SqliteDb &operator=(const SqliteDb &) = delete;
    SqliteDb(const SqliteDb &) = delete;
};

class Database : public jsi::HostObject
{
public:
    static void install(jsi::Runtime *runtime);
    Database(jsi::Runtime *runtime);
    ~Database();

    jsi::Value find(jsi::Runtime &rt, jsi::String &tableName, jsi::String &id);
    jsi::Value query(jsi::Runtime &rt, jsi::String &tableName, jsi::String &sql, jsi::Array &arguments);
    jsi::Value count(jsi::Runtime &rt, jsi::String &sql, jsi::Array &arguments);
    void batch(jsi::Runtime &runtime, jsi::Array &operations);
    jsi::Array getDeletedRecords(jsi::Runtime &rt, jsi::String &tableName);
    void destroyDeletedRecords(jsi::Runtime &rt, jsi::String &tableName, jsi::Array &recordIds);
    void unsafeResetDatabase(jsi::Runtime &rt, jsi::String &schema, jsi::Value &schemaVersion);
    jsi::String getLocal(jsi::Runtime &rt, jsi::String &key);
    void setValue(jsi::Runtime &rt, jsi::String &key, jsi::String &value);
    void removeLocal(jsi::Runtime &rt, jsi::String &key);

private:
    jsi::Runtime *runtime_; // TODO: std::shared_ptr would be better, but I don't know how to make it from void* in RCTCxxBridge
    std::unique_ptr<SqliteDb> db_;
    std::map<std::string, sqlite3_stmt *> cachedStatements_;

    void executeUpdate(jsi::Runtime &rt, std::string sql, jsi::Array &arguments);
};

} // namespace watermelondb
