#import "WMDatabase.h"
#import <sqlite3.h>

@implementation WMDatabase {
    NSString *_path;
}

- (instancetype) initWithPath:(NSString *)path
{
    if (self = [super init]) {
        _path = path;
        _fmdb = [FMDatabase databaseWithPath:path];
    }
    
    return self;
}

+ (instancetype) databaseWithPath:(NSString *)path
{
    return [[self alloc] initWithPath:path];
}

- (void) open
{
    NSAssert([_fmdb open], @"Failed to open the database: %@", _fmdb.lastErrorMessage);
    
    // TODO: Experiment with WAL
    //     // must be queryRaw - returns value
    //     _ = try queryRaw("pragma journal_mode=wal")
    
    // TODO: Configurable logger
    NSLog(@"Opened database at %@", _path);
}

#pragma mark - Executing queries

- (BOOL) executeQuery:(NSString *)query args:(NSArray *)args error:(NSError **)errorPtr
{
    return [_fmdb executeUpdate:query values:args error:errorPtr];
}

/// Executes multiple queries separated by `;`
- (BOOL) executeStatements:(NSString *)sql error:(NSError **)errorPtr
{
    if (![_fmdb executeStatements:sql]) {
        *errorPtr = _fmdb.lastError;
        return NO;
    }
    
    return YES;
}

- (FMResultSet *) queryRaw:(NSString *)query args:(NSArray *)args error:(NSError **)errorPtr
{
    return [_fmdb executeQuery:query values:args error:errorPtr];
}

- (NSNumber * _Nullable) count:(NSString *)query args:(NSArray *)args error:(NSError **)errorPtr
{
    FMResultSet *result = [_fmdb executeQuery:query values:args error:errorPtr];
    
    if (!result) {
        *errorPtr = _fmdb.lastError;
        return nil;
    }
    
    if (![result next]) {
        *errorPtr = [NSError errorWithDomain:@"WMDatabase" code:0 userInfo:@{
            NSLocalizedDescriptionKey: @"Invalid count query, can't find next() on the result"
        }];
        return nil;
    }
    
    if ([result columnIndexForName:@"count"] != 1) {
        *errorPtr = [NSError errorWithDomain:@"WMDatabase" code:0 userInfo:@{
            NSLocalizedDescriptionKey: @"Invalid count query, can't find `count` column"
        }];
        return nil;
    }
    
    return @([result intForColumn:@"count"]);
}

#pragma mark - Other database functions

- (BOOL) inTransaction:(BOOL (^)(NSError**))transactionBlock error:(NSError**)errorPtr
{
    if (![_fmdb beginTransaction]) {
        *errorPtr = _fmdb.lastError;
        return NO;
    }
    
    BOOL txnResult = transactionBlock(errorPtr);
    
    if (txnResult) {
        if (![_fmdb commit]) {
            *errorPtr = _fmdb.lastError;
            return NO;
        }
        return YES;
    } else {
        if (![_fmdb rollback]) {
            *errorPtr = _fmdb.lastError;
        }
        return NO;
    }
}

- (long) userVersion
{
    FMResultSet *result = [_fmdb executeQuery:@"pragma user_version"];
    [result next];
    return [result longForColumnIndex:0];
}

- (void) setUserVersion:(long)userVersion
{
    BOOL result = [_fmdb executeUpdateWithFormat:@"pragma user_version = %li", userVersion];
    NSAssert(result, @"Failed to set user version: %@", _fmdb.lastError);
}

- (BOOL) unsafeDestroyEverything:(NSError**)errorPtr
{
    // NOTE: Deleting files by default because it seems simpler, more reliable
    // But sadly this won't work for in-memory (shared) databases
    if ([self isInMemoryDatabase]) {
        // NOTE: As of iOS 14, selecting tables from sqlite_master and deleting them does not work
        // They seem to be enabling "defensive" config. So we use another obscure method to clear the database
        // https://www.sqlite.org/c3ref/c_dbconfig_defensive.html#sqlitedbconfigresetdatabase
        
        if (sqlite3_db_config(_fmdb.sqliteHandle, SQLITE_DBCONFIG_RESET_DATABASE, 1, 0) != SQLITE_OK) {
            *errorPtr = [NSError errorWithDomain:@"WMDatabase" code:0 userInfo:@{
                NSLocalizedDescriptionKey: @"Failed to enable reset database mode",
                @"FMDBError": _fmdb.lastError
            }];
            return NO;
        }
        
        if (![self executeStatements:@"vacuum" error:errorPtr]) {
            return NO;
        }
        
        if (sqlite3_db_config(_fmdb.sqliteHandle, SQLITE_DBCONFIG_RESET_DATABASE, 0, 0) != SQLITE_OK) {
            *errorPtr = [NSError errorWithDomain:@"WMDatabase" code:0 userInfo:@{
                NSLocalizedDescriptionKey: @"Failed to disable reset database mode",
                @"FMDBError": _fmdb.lastError
            }];
            return NO;
        }
        
        return YES;
    } else {
        if (![_fmdb close]) {
            *errorPtr = [NSError errorWithDomain:@"WMDatabase" code:0 userInfo:@{
                NSLocalizedDescriptionKey: @"Could not close database",
                @"FMDBError": _fmdb.lastError
            }];
            return NO;
        }
        
        NSFileManager *manager = [NSFileManager defaultManager];
        
        // remove database
        if (![manager removeItemAtPath:_path error:errorPtr]) {
            return NO;
        }
        
        // try removing database WAL files (ignore errors)
        [manager removeItemAtPath:[NSString stringWithFormat:@"%@-wal", _path] error:nil];
        [manager removeItemAtPath:[NSString stringWithFormat:@"%@-shm", _path] error:nil];
        
        // reopen database
        [self open];
        return YES;
    }
}

# pragma mark - Private helpers

- (BOOL) isInMemoryDatabase
{
    return [_path isEqualToString:@":memory:"]
        || [_path isEqualToString:@"file::memory:"]
        || [_path containsString:@"?mode=memory"];
}

@end

