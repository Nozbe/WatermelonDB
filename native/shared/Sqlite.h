#pragma once

#include <string>
#include <sqlite3.h>

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

// RAII guard for a prepared statement handed out by Database::prepareQuery: resets the statement
// when it goes out of scope and, while alive, pins the statement in the statement cache so that
// it cannot be evicted (and finalized) while a caller is still using it
class SqliteStatement {
public:
    SqliteStatement(sqlite3_stmt *statement, unsigned *pinCount = nullptr);
    SqliteStatement(SqliteStatement &&other) noexcept;
    ~SqliteStatement();

    SqliteStatement &operator=(const SqliteStatement &) = delete;
    SqliteStatement(const SqliteStatement &) = delete;

    sqlite3_stmt *stmt;

    void reset();

private:
    unsigned *pinCount_;
};

} // namespace watermelondb

