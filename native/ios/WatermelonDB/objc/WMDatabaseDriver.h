#import "WMDatabase.h"

NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(NSInteger, WMDatabaseCompatibility) {
    WMDatabaseCompatibilityCompatible,
    WMDatabaseCompatibilityNeedsSetup,
    WMDatabaseCompatibilityNeedsMigration,
};

@interface WMDatabaseDriver : NSObject

@property (readwrite, strong, nonatomic) WMDatabase *db;
@property (readonly, strong, nonatomic) NSMutableDictionary<NSString *, NSMutableSet<NSString *> *> *cachedRecords;

#pragma mark - Initialization

+ (instancetype) driverWithName:(NSString *)dbName;

#pragma mark - Setup

- (long) schemaVersion;
- (WMDatabaseCompatibility) isCompatibleWithSchemaVersion:(long)version;
- (void) setUpWithSchema:(NSString *)sql schemaVersion:(long)version;
- (BOOL) setUpWithMigrations:(NSString *)sql fromVersion:(long)fromVersion toVersion:(long)toVersion error:(NSError **)errorPtr;

#pragma mark - Database functions

- (id) find:(NSString *)table id:(NSString *)id error:(NSError **)errorPtr;
- (NSArray *) cachedQuery:(NSString *)table query:(NSString *)query args:(NSArray *)args error:(NSError **)errorPtr;
- (NSArray *) queryIds:(NSString *)query args:(NSArray *)args error:(NSError **)errorPtr;
- (NSArray *) unsafeQueryRaw:(NSString *)query args:(NSArray *)args error:(NSError **)errorPtr;
- (NSNumber *) count:(NSString *)query args:(NSArray *)args error:(NSError **)errorPtr;
- (BOOL) batch:(NSArray<NSArray *> *)operations error:(NSError **)errorPtr;
- (NSString *) getLocal:(NSString *)key error:(NSError **)errorPtr;
- (BOOL) unsafeResetDatabaseWithSchema:(NSString *)sql schemaVersion:(long)version error:(NSError **)errorPtr;

@end

NS_ASSUME_NONNULL_END
