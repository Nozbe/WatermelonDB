#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_REMAP_MODULE(DatabaseBridge, DatabaseBridge, NSObject)

#define WMELON_CONCAT(A, B) A ## B
#define WMELON_BRIDGE_METHOD(name, args) \
  RCT_EXTERN_METHOD(name:(nonnull NSNumber *)connectionTag \
    args \
    resolve:(RCTPromiseResolveBlock)resolve \
    reject:(RCTPromiseRejectBlock)reject \
  )

WMELON_BRIDGE_METHOD(initialize,
  databaseName:(nonnull NSString *)name
  schemaVersion:(nonnull NSNumber *)version
)

WMELON_BRIDGE_METHOD(setUpWithSchema,
  databaseName:(nonnull NSString *)name
  schema:(nonnull NSString *)schema
  schemaVersion:(nonnull NSNumber *)version
)

WMELON_BRIDGE_METHOD(setUpWithMigrations,
  databaseName:(nonnull NSString *)name
  migrations:(nonnull NSString *)migrationSQL
  fromVersion:(nonnull NSNumber *)version
  toVersion:(nonnull NSNumber *)version
)

WMELON_BRIDGE_METHOD(find,
  table:(nonnull NSString *)table
  id:(nonnull NSString *)id
)

WMELON_BRIDGE_METHOD(query,
  table:(nonnull NSString *)table
  query:(nonnull NSString *)query
  args:(nonnull NSArray *)args
)

WMELON_BRIDGE_METHOD(queryIds,
  query:(nonnull NSString *)query
  args:(nonnull NSArray *)args
)

WMELON_BRIDGE_METHOD(unsafeQueryRaw,
  query:(nonnull NSString *)query
  args:(nonnull NSArray *)args
)

WMELON_BRIDGE_METHOD(count,
  query:(nonnull NSString *)query
  args:(nonnull NSArray *)args
)

WMELON_BRIDGE_METHOD(batchJSON,
  operations:(NSString *)serializedOperations
)

WMELON_BRIDGE_METHOD(unsafeResetDatabase,
  schema:(nonnull NSString *)schema
  schemaVersion:(nonnull NSNumber *)version
)

WMELON_BRIDGE_METHOD(getLocal,
  key:(nonnull NSString *)key
)

RCT_EXTERN__BLOCKING_SYNCHRONOUS_METHOD(initializeJSI)

RCT_EXTERN_METHOD(provideSyncJson:(nonnull NSNumber *)id \
  json:(nonnull NSString *)json \
  resolve:(RCTPromiseResolveBlock)resolve \
  reject:(RCTPromiseRejectBlock)reject \
)

@end
