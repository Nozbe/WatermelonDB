#import "WMDatabaseDriver.h"

typedef NS_ENUM(NSInteger, WMDatabaseCompatibility) {
    WMDatabaseCompatibilityCompatible,
    WMDatabaseCompatibilityNeedsSetup,
    WMDatabaseCompatibilityNeedsMigration,
};

@implementation WMDatabaseDriver

#pragma mark - Initialization

- (instancetype) initWithName:(NSString *)dbName
{
    if (self = [super init]) {
        _db = [WMDatabase databaseWithPath:[self pathForName:dbName]];
        _cachedRecords = [NSMutableDictionary dictionary];
    }

    return self;
}

+ (instancetype) driverWithName:(NSString *)dbName
{
    return [[self alloc] initWithName:dbName];
}

- (NSString *) pathForName:(NSString *)dbName
{
    // If starts with `file:` or contains `/`, it's a path!
    if ([dbName hasPrefix:@"file:"] || [dbName containsString:@"/"]) {
        return dbName;
    } else {
        NSURL *url = [[NSFileManager defaultManager] URLForDirectory:NSDocumentDirectory
                                                            inDomain:NSUserDomainMask
                                                   appropriateForURL:nil
                                                              create:false
                                                               error:nil];

        return [[url URLByAppendingPathComponent:[NSString stringWithFormat:@"%@.db", dbName]] path];
    }
}

#pragma mark - Setup

- (long) schemaVersion
{
    return _db.userVersion;
}

- (WMDatabaseCompatibility) isCompatibleWithSchemaVersion:(long)version
{
    long dbVersion = _db.userVersion;

    if (version == dbVersion) {
        return WMDatabaseCompatibilityCompatible;
    } else if (dbVersion == 0) {
        return WMDatabaseCompatibilityNeedsSetup;
    } else if (dbVersion >= 1 && dbVersion < version) {
        return WMDatabaseCompatibilityNeedsMigration;
    } else {
        // TODO: Add logger customization
        NSLog(@"Database has newer version (%li) than what the app supports (%li). Will reset database.", dbVersion, version);
        return WMDatabaseCompatibilityNeedsSetup;
    }
}

- (void) setUpWithSchema:(NSString *)sql schemaVersion:(long)version
{
    NSError *error;
    if (![self unsafeResetDatabaseWithSchema:sql schemaVersion:version error:&error]) {
        [NSException raise:@"SetUpWithSchemaFailed" format:@"Error while setting up the database: %@", error];
    }
}

- (BOOL) setUpWithMigrations:(NSString *)sql fromVersion:(long)fromVersion toVersion:(long)toVersion error:(NSError **)errorPtr
{
    long databaseVersion = _db.userVersion;
    if (databaseVersion != fromVersion) {
        [NSException raise:@"IncompatibleMigrations"
                    format:@"Incompatbile migration set applied. DB: %li, migration: %li", databaseVersion, fromVersion];
    }

    __block WMDatabase *db = _db;
    BOOL txnResult = [db inTransaction:^BOOL(NSError **innerErrorPtr) {
        if (![db executeStatements:sql error:innerErrorPtr]) {
            return NO;
        }
        [db setUserVersion:toVersion];

        return YES;
    } error:errorPtr];

    return txnResult;
}

#pragma mark - Database functions

- (id) find:(NSString *)table id:(NSString *)id error:(NSError **)errorPtr
{
    if ([self isCached:table id:id]) {
        return id;
    }

    NSString *query = [NSString stringWithFormat:@"select * from `%@` where id == ? limit 1", table];
    FMResultSet *result = [_db queryRaw:query args:@[id] error:errorPtr];

    if (![result next]) {
        return nil;
    }

    [self markAsCached:table id:id];
    return [result resultDictionary];
}

- (NSArray *) cachedQuery:(NSString *)table query:(NSString *)query args:(NSArray *)args error:(NSError **)errorPtr
{
    NSMutableArray *resultArray;
    FMResultSet *result = [_db queryRaw:query args:args error:errorPtr];
    if (!resultArray) {
        return nil;
    }

    while ([result next]) {
        NSString *id = [result stringForColumn:@"id"];
        if ([self isCached:table id:id]) {
            [resultArray addObject:id];
        } else {
            [self markAsCached:table id:id];
            [resultArray addObject:[result resultDictionary]];
        }
    }

    return resultArray;
}

- (NSArray *) queryIds:(NSString *)query args:(NSArray *)args error:(NSError **)errorPtr
{
    NSMutableArray *resultArray;
    FMResultSet *result = [_db queryRaw:query args:args error:errorPtr];
    if (!resultArray) {
        return nil;
    }

    while ([result next]) {
        [resultArray addObject:[result stringForColumn:@"id"]];
    }

    return resultArray;
}

- (NSArray *) unsafeQueryRaw:(NSString *)query args:(NSArray *)args error:(NSError **)errorPtr
{
    NSMutableArray *resultArray;
    FMResultSet *result = [_db queryRaw:query args:args error:errorPtr];
    if (!resultArray) {
        return nil;
    }

    while ([result next]) {
        [resultArray addObject:[result resultDictionary]];
    }

    return resultArray;
}

- (NSNumber *) count:(NSString *)query args:(NSArray *)args error:(NSError **)errorPtr
{
    return [_db count:query args:args error:errorPtr];
}

// Look for NativeBridgeBatchOperation type
- (BOOL) batch:(NSArray<NSArray *> *)operations error:(NSError **)errorPtr
{
    // TODO: Refactor for perf to use cacheKeys ala Database.cpp ?
    NSMutableArray *addedIds = [NSMutableArray array];
    NSMutableArray *removedIds = [NSMutableArray array];

    __block WMDatabase *db = _db;
    BOOL txnResult = [db inTransaction:^BOOL(NSError **innerErrorPtr) {
        for (NSArray *operation in operations) {
            NSNumber *cacheBehavior = operation[0];
            NSString *table = operation[1];
            NSString *sql = operation[2];
            NSArray *argBatches = operation[3];

            for (NSArray *args in argBatches) {
                if (![db executeQuery:sql args:args error:innerErrorPtr]) {
                    return NO;
                }

                if (cacheBehavior.intValue == 1) {
                    [addedIds addObject:@[table, args[0]]];
                } else if (cacheBehavior.intValue == -1) {
                    [removedIds addObject:@[table, args[0]]];
                }
            }
        }

        return YES;
    } error:errorPtr];

    if (!txnResult) {
        return NO;
    }

    for (NSArray *pair in addedIds) {
        [self markAsCached:pair[0] id:pair[1]];
    }

    for (NSArray *pair in removedIds) {
        [self removeFromCache:pair[0] id:pair[1]];
    }

    return YES;
}

- (NSString *) getLocal:(NSString *)key error:(NSError **)errorPtr
{
    // TODO: Shouldn't this be moved to JS, handled by queryRaw?
    FMResultSet *result = [_db queryRaw:@"select `value` from `local_storage` where `key` = ?" args:@[key] error:errorPtr];

    if (![result next]) {
        return nil;
    }

    return [result stringForColumn:@"value"];
}

- (BOOL) unsafeResetDatabaseWithSchema:(NSString *)sql schemaVersion:(long)version error:(NSError **)errorPtr
{
    if (![_db unsafeDestroyEverything:errorPtr]) {
        return NO;
    }
    _cachedRecords = [NSMutableDictionary dictionary];

    __block WMDatabase *db = _db;
    BOOL txnResult = [db inTransaction:^BOOL(NSError **innerErrorPtr) {
        if (![db executeStatements:sql error:innerErrorPtr]) {
            return NO;
        }
        [db setUserVersion:version];

        return YES;
    } error:errorPtr];

    return txnResult;
}

#pragma mark - Record caching

- (BOOL) isCached:(NSString *)table id:(NSString *)id
{
    if ([_cachedRecords[table] containsObject:id]) {
        return YES;
    }
    return NO;
}

- (void) markAsCached:(NSString *)table id:(NSString *)id
{
    NSMutableSet *set = _cachedRecords[table];
    if (!set) {
        set = [NSMutableSet set];
        _cachedRecords[table] = set;
    }
    [set addObject:id];
}

- (void) removeFromCache:(NSString *)table id:(NSString *)id
{
    [_cachedRecords[table] removeObject:id];
}

@end
