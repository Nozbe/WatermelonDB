#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_REMAP_MODULE(DatabaseBridge, DatabaseBridge, NSObject)

RCT_EXTERN_METHOD(initialize:(nonnull NSNumber *)connectionTag
  databaseName:(nonnull NSString *)name
  schemaVersion:(nonnull NSNumber *)version
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(setUpWithSchema:(nonnull NSNumber *)connectionTag
  databaseName:(nonnull NSString *)name
  schema:(nonnull NSString *)schema
  schemaVersion:(nonnull NSNumber *)version
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(setUpWithMigrations:(nonnull NSNumber *)connectionTag
  databaseName:(nonnull NSString *)name
  migrations:(nonnull NSString *)migrationSQL
  fromVersion:(nonnull NSNumber *)version
  toVersion:(nonnull NSNumber *)version
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(find:(nonnull NSNumber *)connectionTag
  table:(nonnull NSString *)table
  id:(nonnull NSString *)id
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(query:(nonnull NSNumber *)connectionTag
  table:(nonnull NSString *)table
  query:(nonnull NSString *)query
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN__BLOCKING_SYNCHRONOUS_METHOD(querySync:(nonnull NSNumber *)connectionTag
  table:(nonnull NSString *)table
  query:(nonnull NSString *)query
)

RCT_EXTERN_METHOD(count:(nonnull NSNumber *)connectionTag
  query:(nonnull NSString *)query
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(batch:(nonnull NSNumber *)connectionTag
  operations:(NSArray *)operations
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(batchJSON:(nonnull NSNumber *)connectionTag
  operations:(NSString *)serializedOperations
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(getDeletedRecords:(nonnull NSNumber *)connectionTag
  table:(nonnull NSString *)table
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(destroyDeletedRecords:(nonnull NSNumber *)connectionTag
  table:(nonnull NSString *)table
  records:(NSArray<NSString *>*)recordIds
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(unsafeResetDatabase:(nonnull NSNumber *)connectionTag
  schema:(nonnull NSString *)schema
  schemaVersion:(nonnull NSNumber *)version
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(getLocal:(nonnull NSNumber *)connectionTag
  key:(nonnull NSString *)key
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(setLocal:(nonnull NSNumber *)connectionTag
  key:(nonnull NSString *)key
  value:(nonnull NSString *)value
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(removeLocal:(nonnull NSNumber *)connectionTag
  key:(nonnull NSString *)key
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

@end
