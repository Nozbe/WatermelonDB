#pragma once

#import <jsi/jsi.h>
#import <sqlite3.h>
#import <unordered_map>

using namespace facebook;

namespace watermelondb {

// Lightweight wrapper for handling sqlite3 lifetime
class SqliteDb {
public:
    SqliteDb(std::string path);
    ~SqliteDb();

    sqlite3 *sqlite;

    SqliteDb & operator=(const SqliteDb &) = delete;
    SqliteDb(const SqliteDb &) = delete;
};

class Database : public jsi::HostObject {
public:
    static void install(jsi::Runtime *runtime);
    Database(jsi::Runtime *runtime);
    ~Database();

private:
    jsi::Runtime *runtime_; // TODO: std::shared_ptr would be better, but I don't know how to make it from void* in RCTCxxBridge
    std::unique_ptr<SqliteDb> db_;
    std::unordered_map<std::string, sqlite3_stmt*> cachedStatements_;

    void executeUpdate(jsi::Runtime& rt, jsi::String& sql, jsi::Array& arguments);
    void batch(jsi::Runtime& runtime, jsi::Array& operations);
};

} // namespace watermelondb
