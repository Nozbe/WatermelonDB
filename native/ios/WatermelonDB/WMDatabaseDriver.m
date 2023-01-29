#import "WMDatabaseDriver.h"

typedef NS_ENUM(NSInteger, WMDatabaseCompatibility) {
    WMDatabaseCompatibilityCompatible,
    WMDatabaseCompatibilityNeedsSetup,
    WMDatabaseCompatibilityNeedsMigration,
};

@implementation WMDatabaseDriver

#pragma - Initialization

- (instancetype) initWithName:(NSString *)dbName
{
    if (self = [super init]) {
        _db = [WMDatabase databaseWithPath:[self pathForName:dbName]];
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

#pragma - Setup

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

@end
