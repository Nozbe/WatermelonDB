#pragma once

#import <Foundation/Foundation.h>
#import <React/RCTBridge+Private.h>

@interface MelonModule : NSObject <RCTBridgeModule>

- (int) getInt;
- (double) getDouble;
- (double) getMul:(double)a b:(double)b;
- (void) nativeLog:(nonnull NSString *)text;

- (void) initialize:(nonnull NSNumber *)connectionTag
       databaseName:(nonnull NSString *)name
      schemaVersion:(nonnull NSNumber *)version
            resolve:(RCTPromiseResolveBlock _Nonnull)resolve
             reject:(RCTPromiseRejectBlock _Nonnull)reject;

- (void) setUpWithSchema:(nonnull NSNumber *)connectionTag
  databaseName:(nonnull NSString *)name
  schema:(nonnull NSString *)schema
  schemaVersion:(nonnull NSNumber *)version
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject;

- (void) setUpWithMigrations:(nonnull NSNumber *)connectionTag
  databaseName:(nonnull NSString *)name
  migrations:(nonnull NSString *)migrationSQL
  fromVersion:(nonnull NSNumber *)version
  toVersion:(nonnull NSNumber *)version
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject;

- (void) find:(nonnull NSNumber *)connectionTag
  table:(nonnull NSString *)table
  id:(nonnull NSString *)id
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject;

- (void) query:(nonnull NSNumber *)connectionTag
  table:(nonnull NSString *)table
  query:(nonnull NSString *)query
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject;

- (void) count:(nonnull NSNumber *)connectionTag
  query:(nonnull NSString *)query
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject;

- (void) batch:(nonnull NSNumber *)connectionTag
  operations:(NSArray *)operations
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject;

- (void) getDeletedRecords:(nonnull NSNumber *)connectionTag
  table:(nonnull NSString *)table
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject;

- (void) destroyDeletedRecords:(nonnull NSNumber *)connectionTag
  table:(nonnull NSString *)table
  records:(NSArray<NSString *>*)recordIds
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject;

- (void) unsafeResetDatabase:(nonnull NSNumber *)connectionTag
  schema:(nonnull NSString *)schema
  schemaVersion:(nonnull NSNumber *)version
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject;

- (void) getLocal:(nonnull NSNumber *)connectionTag
  key:(nonnull NSString *)key
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject;

- (void) setLocal:(nonnull NSNumber *)connectionTag
  key:(nonnull NSString *)key
  value:(nonnull NSString *)value
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject;

- (void) removeLocal:(nonnull NSNumber *)connectionTag
  key:(nonnull NSString *)key
  resolve:(RCTPromiseResolveBlock)resolve
  reject:(RCTPromiseRejectBlock)reject;

@end

