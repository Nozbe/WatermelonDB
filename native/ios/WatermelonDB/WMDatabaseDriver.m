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

// TODO: setUpWithSchema
// TODO: setUpWithMigrations

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
