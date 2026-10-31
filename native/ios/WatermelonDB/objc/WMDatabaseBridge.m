#import "WMDatabaseBridge.h"
#import "WMDatabaseDriver.h"
#import "JSIInstaller.h"

@implementation WMDatabaseBridge {
    NSMutableDictionary<NSNumber *, WMDatabaseDriver *> *_connections;
    NSMutableDictionary<NSNumber *, NSMutableArray *> *_queue; // operations waiting on a connection
}

#pragma mark - RCTBridgeModule stuff

RCT_EXPORT_MODULE();

@synthesize bridge = _bridge;

- (instancetype)init
{
    self = [super init];
    if (self) {
        _connections = [NSMutableDictionary dictionary];
        _queue = [NSMutableDictionary dictionary];
    }
    return self;
}

- (dispatch_queue_t) methodQueue
{
    // TODO: userInteractive QOS seems wrong, but that's what the Swift implementation used so far
    dispatch_queue_attr_t attr = dispatch_queue_attr_make_with_qos_class(DISPATCH_QUEUE_SERIAL, QOS_CLASS_USER_INTERACTIVE, 0);
    return dispatch_queue_create("com.nozbe.watermelondb.database", attr);
}

+ (BOOL) requiresMainQueueSetup
{
    return NO;
}

#define BRIDGE_METHOD(name, args) \
    RCT_EXPORT_METHOD(name:(nonnull NSNumber *)tag \
        args \
        resolve:(RCTPromiseResolveBlock)resolve \
        reject:(RCTPromiseRejectBlock)reject \
    )

#pragma mark - Initialization & Setup

BRIDGE_METHOD(initialize,
    databaseName:(nonnull NSString *)name
    schemaVersion:(nonnull NSNumber *)version
)
{
    if (_connections[tag] || _queue[tag]) {
        return reject(@"db.initialize.error", [NSString stringWithFormat:@"A driver with tag %@ is already set up", tag], nil);
    }
    
    NSError *error;
    WMDatabaseDriver *driver = [WMDatabaseDriver driverWithName:name error:&error];
    if (!driver) {
        return reject(@"db.initialize.error", error.localizedDescription, error);
    }
    WMDatabaseCompatibility compatibility = [driver isCompatibleWithSchemaVersion:[version integerValue]];
    
    if (compatibility == WMDatabaseCompatibilityCompatible) {
        _connections[tag] = driver;
        return resolve(@{@"code": @"ok"});
    } else if (compatibility == WMDatabaseCompatibilityNeedsSetup) {
        _queue[tag] = [NSMutableArray array];
        return resolve(@{@"code": @"schema_needed"});
    } else if (compatibility == WMDatabaseCompatibilityNeedsMigration) {
        _queue[tag] = [NSMutableArray array];
        return resolve(@{@"code": @"migrations_needed", @"databaseVersion": @(driver.schemaVersion)});
    }
    
    return reject(@"db.initialize.error", @"Unexpected WMDatabaseCompatibility", nil);
}

BRIDGE_METHOD(setUpWithSchema,
    databaseName:(nonnull NSString *)name
    schema:(nonnull NSString *)schema
    schemaVersion:(nonnull NSNumber *)version
)
{
    NSError *error;
    WMDatabaseDriver *driver = [WMDatabaseDriver driverWithName:name error:&error];
    
    if (driver && [driver setUpWithSchema:schema schemaVersion:[version integerValue] error:&error]) {
        [self connectDriverAsync:tag driver:driver];
        return resolve(@YES);
    } else {
        [self connectDriverAsync:tag driver:driver setUpError:error];
        return reject(@"db.setUpWithSchema.error", error.localizedDescription, error);
    }
}

BRIDGE_METHOD(setUpWithMigrations,
    databaseName:(nonnull NSString *)name
    migrations:(nonnull NSString *)migrationSQL
    fromVersion:(nonnull NSNumber *)fromVersion
    toVersion:(nonnull NSNumber *)toVersion
)
{
    NSError *error;
    WMDatabaseDriver *driver = [WMDatabaseDriver driverWithName:name error:&error];
    
    if (driver && [driver setUpWithMigrations:migrationSQL fromVersion:[fromVersion integerValue] toVersion:[toVersion integerValue] error:&error]) {
        [self connectDriverAsync:tag driver:driver];
        return resolve(@YES);
    } else {
        [self connectDriverAsync:tag driver:driver setUpError:error];
        return reject(@"db.setUpWithMigrations.error", error.localizedDescription, error);
    }
}

#pragma mark - Database functions

#define WITH_DRIVER(block) \
    [self withDriver:tag resolve:resolve reject:reject methodName:__PRETTY_FUNCTION__ action:^(WMDatabaseDriver *driver, NSError **errorPtr) block ];

BRIDGE_METHOD(find,
    table:(nonnull NSString *)table
    id:(nonnull NSString *)id
)
{
    WITH_DRIVER({
        return [driver find:table id:id error:errorPtr];
    })
}

BRIDGE_METHOD(query,
    table:(nonnull NSString *)table
    query:(nonnull NSString *)query
    args:(nonnull NSArray *)args
)
{
    WITH_DRIVER({
        return [driver cachedQuery:table query:query args:args error:errorPtr];
    })
}

BRIDGE_METHOD(queryIds,
    query:(nonnull NSString *)query
    args:(nonnull NSArray *)args
)
{
    WITH_DRIVER({
        return [driver queryIds:query args:args error:errorPtr];
    })
}

BRIDGE_METHOD(unsafeQueryRaw,
    query:(nonnull NSString *)query
    args:(nonnull NSArray *)args
)
{
    WITH_DRIVER({
        return [driver unsafeQueryRaw:query args:args error:errorPtr];
    })
}

BRIDGE_METHOD(count,
    query:(nonnull NSString *)query
    args:(nonnull NSArray *)args
)
{
    WITH_DRIVER({
        return [driver count:query args:args error:errorPtr];
    })
}

BRIDGE_METHOD(batchJSON,
    operations:(NSString *)serializedOperations
)
{
    WITH_DRIVER({
        NSData *jsonData = [serializedOperations dataUsingEncoding:NSUTF8StringEncoding];
        NSArray *operations = [NSJSONSerialization JSONObjectWithData:jsonData options:0 error:errorPtr];
        if (!operations) {
            return @NO;
        }
        [driver batch:operations error:errorPtr];
        return @YES;
    })
}

BRIDGE_METHOD(unsafeResetDatabase,
    schema:(nonnull NSString *)schema
    schemaVersion:(nonnull NSNumber *)version
)
{
    WITH_DRIVER({
        [driver unsafeResetDatabaseWithSchema:schema schemaVersion:[version integerValue] error:errorPtr];
        return @YES;
    })
}

BRIDGE_METHOD(getLocal,
    key:(nonnull NSString *)key
)
{
    WITH_DRIVER({
        return [driver getLocal:key error:errorPtr];
    })
}

#pragma mark - JSI Support

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(initializeJSI)
{
    __block RCTCxxBridge *bridge = (RCTCxxBridge *) _bridge;
    dispatch_sync([self methodQueue], ^{
        installWatermelonJSI(bridge);
    });
    
    return @YES;
}


RCT_EXPORT_METHOD(provideSyncJson:(nonnull NSNumber *)id
    json:(nonnull NSString *)json
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject)
{
    NSError *error;
    watermelondbProvideSyncJson(id.intValue, [json dataUsingEncoding:NSUTF8StringEncoding], &error);
    if (error) {
        reject(@"db.provideSyncJson.error", error.localizedDescription, error);
    } else {
        resolve(@YES);
    }
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(getRandomBytes:(nonnull NSNumber *)count)
{
    size_t batchSize = 256;
    if (![count isEqualToNumber:@(batchSize)]) {
        [NSException raise:@"getRandomBytes" format:@"Expected getRandomBytes to be called with 256"];
    }
    
    uint8_t randomBuffer[batchSize];
    arc4random_buf(&randomBuffer, batchSize);
    
    NSMutableArray *result = [NSMutableArray array];
    for (size_t i = 0; i < batchSize; i++) {
        result[i] = @(randomBuffer[i]);
    }
    return result;
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(getRandomIds)
{
    static const char alphabet[] = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    size_t batchSize = 64;
    char randomIds[batchSize * 17];
    
    for (size_t i = 0; i < batchSize; i++) {
        for (size_t j = 0; j < 16; j++) {
            randomIds[i*17 + j] = alphabet[arc4random_uniform(62)];
        }
        if (i != (batchSize - 1)) {
            randomIds[i*17 + 16] = ',';
        }
    }
    
    return [NSString stringWithCString:randomIds encoding:NSUTF8StringEncoding];
}

#pragma mark - Helpers

- (void) connectDriverAsync:(nonnull NSNumber *)tag
                     driver:(WMDatabaseDriver *)driver
{
    [self connectDriverAsync:tag driver:driver setUpError:nil];
}

// Connects the driver (if setup produced one) and settles the operations queued while waiting for
// it: they are retried if setup succeeded, and rejected with the setup error otherwise.
// NOTE: Setup runs in a transaction, so after a failed setup the database is still consistent and
// the driver stays connected. This lets JS recover (e.g. by calling unsafeResetDatabase) instead
// of every subsequent call hanging on a tag that has neither a driver nor a queue.
- (void) connectDriverAsync:(nonnull NSNumber *)tag
                     driver:(nullable WMDatabaseDriver *)driver
                 setUpError:(nullable NSError *)setUpError
{
    if (driver && driver.db.fmdb.isOpen) {
        _connections[tag] = driver;
    } else {
        // NOTE: A driver whose database could not be (re)opened is of no use - every operation
        // on it would fail, so treat it like a missing driver
        [_connections removeObjectForKey:tag];
    }
    NSArray *queuedOperations = _queue[tag];
    [_queue removeObjectForKey:tag];
    
    for (void (^action)(NSError * _Nullable) in queuedOperations) {
        action(setUpError);
    }
}

- (void) withDriver:(nonnull NSNumber *)tag
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
         methodName:(const char *)methodName
             action:(id (^)(WMDatabaseDriver *, NSError**))action
{
    WMDatabaseDriver *driver = _connections[tag];
    
    if (driver) {
        NSError *error;
        id result = action(driver, &error);
        if (error) {
            NSString *errorName = [NSString stringWithFormat:@"db.%s.error", methodName];
            return reject(errorName, error.localizedDescription, error);
        } else {
            return resolve(result);
        }
    } else {
        NSMutableArray *queuedOperations = _queue[tag];
        if (!queuedOperations) {
            // NOTE: Without this, the operation would be silently dropped and its promise never settled
            NSString *errorName = [NSString stringWithFormat:@"db.%s.error", methodName];
            return reject(errorName, [NSString stringWithFormat:@"No driver with tag %@ available", tag], nil);
        }
        NSLog(@"Operation for driver %@ enqueued", tag);
        
        // try again when driver is ready, or fail if setting it up failed
        void (^queueOperation)(NSError * _Nullable) = ^(NSError * _Nullable setUpError) {
            if (setUpError) {
                NSString *errorName = [NSString stringWithFormat:@"db.%s.error", methodName];
                return reject(errorName, setUpError.localizedDescription, setUpError);
            }
            [self withDriver:tag resolve:resolve reject:reject methodName:methodName action:action];
        };
        
        [queuedOperations addObject:queueOperation];
    }
}

@end
