#pragma once

#import <string>
#import <sqlite3.h>

namespace watermelondb {

// Lightweight wrapper for handling sqlite3 lifetime
class SqliteDb {
public:
    SqliteDb(std::string path);
    ~SqliteDb();
    void destroy();

    sqlite3 *sqlite;

    SqliteDb &operator=(const SqliteDb &) = delete;
    SqliteDb(const SqliteDb &) = delete;

private:
    bool isDestroyed_;
};

class SqliteStatement {
public:
    SqliteStatement(sqlite3_stmt *statement);
    ~SqliteStatement();

    sqlite3_stmt *stmt;

    void reset();
};

} // namespace watermelondb

