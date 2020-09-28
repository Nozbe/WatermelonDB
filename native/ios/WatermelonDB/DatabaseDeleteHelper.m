#import "DatabaseDeleteHelper.h"

BOOL watermelondb_sqlite_dbconfig_reset_database(sqlite3 *db, BOOL enable) {
    return sqlite3_db_config(db, SQLITE_DBCONFIG_RESET_DATABASE, enable, 0) == SQLITE_OK;
}
