#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(DatabaseBridge, NSObject)

RCT_EXTERN_METHOD(setUp:(nonnull NSNumber *)connectionTag
  databaseName:(nonnull NSString *)name
  schema:(nonnull NSString *)schema
  schemaVersion:(nonnull NSNumber *)version
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
  query:(nonnull NSString *)query
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
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

RCT_EXTERN_METHOD(execute:(nonnull NSNumber *)connectionTag
  query:(nonnull NSString *)query
  args:(NSArray *)args
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(create:(nonnull NSNumber *)connectionTag
  id:(nonnull NSString *)id
  query:(nonnull NSString *)query
  args:(NSArray *)args
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(destroyPermanently:(nonnull NSNumber *)connectionTag
  table:(nonnull NSString *)table
  id:(nonnull NSString *)id
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(markAsDeleted:(nonnull NSNumber *)connectionTag
  table:(nonnull NSString *)table
  id:(nonnull NSString *)id
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

RCT_EXTERN_METHOD(unsafeClearCachedRecords:(nonnull NSNumber *)connectionTag
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject
)

@end
