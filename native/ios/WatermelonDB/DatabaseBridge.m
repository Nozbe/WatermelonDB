#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_REMAP_MODULE(DatabaseBridge, DatabaseBridge, NSObject)

#define WMELON_CONCAT(A, B) A ## B
#define WMELON_BRIDGE_METHOD(name, args) \
  RCT_EXTERN_METHOD(name:(nonnull NSNumber *)connectionTag \
    args \
    resolve:(RCTPromiseResolveBlock)resolve \
    reject:(RCTPromiseRejectBlock)reject \
  ) \
  RCT_EXTERN__BLOCKING_SYNCHRONOUS_METHOD(WMELON_CONCAT(name, Sync):(nonnull NSNumber *)connectionTag \
    args \
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
)

WMELON_BRIDGE_METHOD(count,
 query:(nonnull NSString *)query
)

WMELON_BRIDGE_METHOD(batch,
  operations:(NSArray *)operations
)

WMELON_BRIDGE_METHOD(batchJSON,
  operations:(NSString *)serializedOperations
)

WMELON_BRIDGE_METHOD(getDeletedRecords,
  table:(nonnull NSString *)table
)

WMELON_BRIDGE_METHOD(destroyDeletedRecords,
  table:(nonnull NSString *)table
  records:(NSArray<NSString *>*)recordIds
)

WMELON_BRIDGE_METHOD(unsafeResetDatabase,
  schema:(nonnull NSString *)schema
  schemaVersion:(nonnull NSNumber *)version
)

WMELON_BRIDGE_METHOD(getLocal,
  key:(nonnull NSString *)key
)

WMELON_BRIDGE_METHOD(setLocal,
  key:(nonnull NSString *)key
  value:(nonnull NSString *)value
)

WMELON_BRIDGE_METHOD(removeLocal,
  key:(nonnull NSString *)key
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

@end
