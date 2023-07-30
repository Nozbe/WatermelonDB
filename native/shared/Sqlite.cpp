#include "Sqlite.h"
#include "DatabasePlatform.h"
#include <cassert>

namespace watermelondb {

using platform::consoleError;
using platform::consoleLog;

std::string resolveDatabasePath(std::string path) {
    if (path == "" || path == ":memory:" || path.rfind("file:", 0) == 0 || path.rfind("/", 0) == 0) {
        // These seem like paths/sqlite path-like strings
        return path;
    } else {
        // path is a name to be resolved based on platform preferences
        return platform::resolveDatabasePath(path);
    }
}

SqliteDb::SqliteDb(std::string path, const char *password) {
    consoleLog("Will open database...");
    platform::initializeSqlite();
#ifndef ANDROID
    assert(sqlite3_threadsafe());
#endif

    auto resolvedPath = resolveDatabasePath(path);
    int openResult = sqlite3_open(resolvedPath.c_str(), &sqlite);

    if (openResult != SQLITE_OK) {
        if (sqlite) {
            auto error = std::string(sqlite3_errmsg(sqlite));
            throw new std::runtime_error("Error while trying to open database - " + error);
        } else {
            // whoa, sqlite couldn't allocate memory
            throw new std::runtime_error("Error while trying to open database, sqlite is null - " + std::to_string(openResult));
        }
    }
    assert(sqlite != nullptr);
#ifdef SQLITE_HAS_CODEC
    if (password != nullptr && strlen(password) > 0) {
        consoleLog("##### Will set key...");
        sqlite3_key(sqlite, password, (int)strlen(password));
        int rc = sqlite3_exec(sqlite, "SELECT count(*) FROM sqlite_master;", NULL, NULL, NULL);
        if (rc != SQLITE_OK) {
            consoleError("Failed to open encrypted database - " + std::string(sqlite3_errmsg(sqlite)));
            sqlite3_close(sqlite);
            sqlite = nullptr;
            throw new std::runtime_error("Failed to open encrypted database - " + std::string(sqlite3_errmsg(sqlite)));
        }
        consoleLog("##### Key set!");
    }
#endif
    assert(sqlite != nullptr);
    consoleLog("Opened database at " + resolvedPath);
}

void SqliteDb::destroy() {
    if (isDestroyed_) {
        return;
    }
    consoleLog("Closing database...");

    isDestroyed_ = true;
    assert(sqlite != nullptr);

    // Find and finalize all prepared statements
    sqlite3_stmt *stmt;
    while ((stmt = sqlite3_next_stmt(sqlite, nullptr))) {
        consoleError("Leak detected! Finalized a statement when closing database - this means that there were dangling "
                     "statements not held by cachedStatements, or handling of cachedStatements is broken. Please "
                     "collect as much information as possible and file an issue with WatermelonDB repository!");
        sqlite3_finalize(stmt);
    }

    // Close connection
    // NOTE: Applications should finalize all prepared statements, close all BLOB handles, and finish all sqlite3_backup objects
    int closeResult = sqlite3_close(sqlite);

    if (closeResult != SQLITE_OK) {
        // NOTE: We're just gonna log an error. We can't throw an exception here. We could crash, but most likely we're
        // only leaking memory/resources
        consoleError("Failed to close sqlite database - " + std::string(sqlite3_errmsg(sqlite)));
    }

    consoleLog("Database closed.");
}

SqliteDb::~SqliteDb() {
    destroy();
}

SqliteStatement::SqliteStatement(sqlite3_stmt *statement) : stmt(statement) {
}

SqliteStatement::~SqliteStatement() {
    reset();
}

void SqliteStatement::reset() {
    if (stmt) {
        // TODO: I'm confused by whether or not the return value of reset is relevant:
        // If the most recent call to sqlite3_step(S) for the prepared statement S indicated an error, then
        // sqlite3_reset(S) returns an appropriate error code. https://sqlite.org/c3ref/reset.html
        sqlite3_reset(stmt);
        sqlite3_clear_bindings(stmt); // might matter if storing a huge string/blob
                                      //        consoleLog("statement has been reset!");
    }
}

} // namespace watermelondb
