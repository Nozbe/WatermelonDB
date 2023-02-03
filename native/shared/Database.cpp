#include "Database.h"

namespace watermelondb {

using platform::consoleError;
using platform::consoleLog;

Database::Database(jsi::Runtime *runtime, std::string path, bool usesExclusiveLocking) : runtime_(runtime), mutex_() {
    db_ = std::make_unique<SqliteDb>(path);

    std::string initSql = "";

    // FIXME: On Android, Watermelon often errors out on large batches with an IO error, because it
    // can't find a temp store... I tried setting sqlite3_temp_directory to /tmp/something, but that
    // didn't work. Setting temp_store to memory seems to fix the issue, but causes a significant
    // slowdown, at least on iOS (not confirmed on Android). Worth investigating if the slowdown is
    // also present on Android, and if so, investigate the root cause. Perhaps we need to set the temp
    // directory by interacting with JNI and finding a path within the app's sandbox?
    #ifdef ANDROID
    initSql += "pragma temp_store = memory;";
    #endif

    initSql += "pragma journal_mode = WAL;";

    // set timeout before SQLITE_BUSY error is returned
    initSql += "pragma busy_timeout = 5000;";

    #ifdef ANDROID
    // NOTE: This was added in an attempt to fix mysterious `database disk image is malformed` issue when using
    // headless JS services
    // NOTE: This slows things down
    initSql += "pragma synchronous = FULL;";
    #endif
    if (usesExclusiveLocking) {
        // this seems to fix the headless JS service issue but breaks if you have multiple readers
        initSql += "pragma locking_mode = EXCLUSIVE;";
    }

    executeMultiple(initSql);
}

void Database::destroy() {
    const std::lock_guard<std::mutex> lock(mutex_);

    if (isDestroyed_) {
        return;
    }
    isDestroyed_ = true;
    for (auto const &cachedStatement : cachedStatements_) {
        sqlite3_stmt *statement = cachedStatement.second;
        sqlite3_finalize(statement);
    }
    cachedStatements_ = {};
    db_->destroy();
}

Database::~Database() {
    destroy();
}

bool Database::isCached(std::string cacheKey) {
    return cachedRecords_.find(cacheKey) != cachedRecords_.end();
}
void Database::markAsCached(std::string cacheKey) {
    cachedRecords_.insert(cacheKey);
}
void Database::removeFromCache(std::string cacheKey) {
    cachedRecords_.erase(cacheKey);
}

void Database::unsafeResetDatabase(jsi::String &schema, int schemaVersion) {
    auto &rt = getRt();
    const std::lock_guard<std::mutex> lock(mutex_);

    // TODO: in non-memory mode, just delete the DB files
    // NOTE: As of iOS 14, selecting tables from sqlite_master and deleting them does not work
    // They seem to be enabling "defensive" config. So we use another obscure method to clear the database
    // https://www.sqlite.org/c3ref/c_dbconfig_defensive.html#sqlitedbconfigresetdatabase

    if (sqlite3_db_config(db_->sqlite, SQLITE_DBCONFIG_RESET_DATABASE, 1, 0) != SQLITE_OK) {
        throw jsi::JSError(rt, "Failed to enable reset database mode");
    }
    // NOTE: We can't VACUUM in a transaction
    executeMultiple("vacuum");

    if (sqlite3_db_config(db_->sqlite, SQLITE_DBCONFIG_RESET_DATABASE, 0, 0) != SQLITE_OK) {
        throw jsi::JSError(rt, "Failed to disable reset database mode");
    }

    beginTransaction();
    try {
        cachedRecords_ = {};

        // Reinitialize schema
        executeMultiple(schema.utf8(rt));
        setUserVersion(schemaVersion);

        commit();
    } catch (const std::exception &ex) {
        rollback();
        throw;
    }
}

void Database::migrate(jsi::String &migrationSql, int fromVersion, int toVersion) {
    auto &rt = getRt();
    const std::lock_guard<std::mutex> lock(mutex_);

    beginTransaction();
    try {
        assert(getUserVersion() == fromVersion && "Incompatible migration set");

        executeMultiple(migrationSql.utf8(rt));
        setUserVersion(toVersion);

        commit();
    } catch (const std::exception &ex) {
        rollback();
        throw;
    }
}

} // namespace watermelondb
