#pragma once

#import <string>
#ifdef SQLITE_HAS_CODEC
#import "sqlite3.h"
#else
#import <sqlite3.h>
#endif

namespace watermelondb {

// Lightweight wrapper for handling sqlite3 lifetime
class SqliteDb {
    public:
    SqliteDb(std::string path, const char *password);
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
