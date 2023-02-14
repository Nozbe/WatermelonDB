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
    
    WMDatabaseDriver *driver = [WMDatabaseDriver driverWithName:name];
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
    
    [NSException raise:@"BadArgument" format:@"Unexpected WMDatabaseCompatibility"];
}

BRIDGE_METHOD(setUpWithSchema,
    databaseName:(nonnull NSString *)name
    schema:(nonnull NSString *)schema
    schemaVersion:(nonnull NSNumber *)version
)
{
    WMDatabaseDriver *driver = [WMDatabaseDriver driverWithName:name];
    [driver setUpWithSchema:schema schemaVersion:[version integerValue]];
    [self connectDriverAsync:tag driver:driver];
    return resolve(@YES);
}

BRIDGE_METHOD(setUpWithMigrations,
    databaseName:(nonnull NSString *)name
    migrations:(nonnull NSString *)migrationSQL
    fromVersion:(nonnull NSNumber *)fromVersion
    toVersion:(nonnull NSNumber *)toVersion
)
{
    WMDatabaseDriver *driver = [WMDatabaseDriver driverWithName:name];
    NSError *error;
    
    if ([driver setUpWithMigrations:migrationSQL fromVersion:[fromVersion integerValue] toVersion:[toVersion integerValue] error:&error]) {
        [self connectDriverAsync:tag driver:driver];
        return resolve(@YES);
    } else {
        [self disconnectDriver:tag];
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

#pragma mark - Helpers

- (void) connectDriverAsync:(nonnull NSNumber *)tag
                     driver:(WMDatabaseDriver *)driver
{
    _connections[tag] = driver;
    NSArray *queuedOperations = _queue[tag];
    [_queue removeObjectForKey:tag];
    
    for (void (^action)(void) in queuedOperations) {
        action();
    }
}

- (void) disconnectDriver:(nonnull NSNumber *)tag
{
    [_connections removeObjectForKey:tag];
    // NOTE: In Swift, queued operations are executed, which seems wrong
    [_queue removeObjectForKey:tag];
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
        NSLog(@"Operation for driver %@ enqueued", tag);
        NSMutableArray *queuedOperations = _queue[tag];
        
        // try again when driver is ready
        void (^queueOperation)(void) = ^() {
            [self withDriver:tag resolve:resolve reject:reject methodName:methodName action:action];
        };
        
        [queuedOperations addObject:queueOperation];
    }
}

@end
