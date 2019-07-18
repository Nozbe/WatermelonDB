import Foundation
import WatermelonDB

@objc(MelonModuleImpl)
class MelonModuleImpl: NSObject {
    let databaseBridge = DatabaseBridge()

    @objc func getInt() -> Int32 {
        return 1337
    }

    @objc func getDouble() -> Double {
        return 3.14
    }

    @objc func getMul(_ a: Double, b: Double) -> Double {
        return a * b
    }

    @objc func nativeLog(_ text: String) {
        consoleLog(text)
    }

    @objc(initialize:databaseName:schemaVersion:resolve:reject:)
    func initialize(tag: NSNumber,
                          databaseName: String,
                          schemaVersion: NSNumber,
                          resolve: @escaping RCTPromiseResolveBlock,
                          reject: @escaping RCTPromiseRejectBlock) {
        databaseBridge.methodQueue.async { [weak self] in
            self?.databaseBridge.initialize(tag: tag, databaseName: databaseName, schemaVersion: schemaVersion, resolve: resolve, reject: reject)
        }
    }
    
    @objc(setUpWithSchema:databaseName:schema:schemaVersion:resolve:reject:)
    func setUpWithSchema(tag: NSNumber,
                         databaseName: String,
                         schema: String,
                         schemaVersion: NSNumber,
                         resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {
        databaseBridge.methodQueue.async { [weak self] in
            self?.databaseBridge.setUpWithSchema(tag:tag,databaseName:databaseName,schema:schema,schemaVersion:schemaVersion,resolve:resolve,reject:reject)
        }
    }

    @objc(setUpWithMigrations:databaseName:migrations:fromVersion:toVersion:resolve:reject:)
    func setUpWithMigrations(tag: NSNumber, // swiftlint:disable:this function_parameter_count
                             databaseName: String,
                             migrations: String,
                             fromVersion: NSNumber,
                             toVersion: NSNumber,
                             resolve: @escaping RCTPromiseResolveBlock,
                             reject: @escaping RCTPromiseRejectBlock) {
        databaseBridge.methodQueue.async { [weak self] in
            self?.databaseBridge.setUpWithMigrations(tag:tag,databaseName:databaseName,migrations:migrations,fromVersion:fromVersion,toVersion:toVersion,resolve:resolve,reject:reject)
        }
    }

    @objc(find:table:id:resolve:reject:)
    func find(tag: NSNumber,
              table: String,
              id: String,
              resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        databaseBridge.methodQueue.async { [weak self] in
            self?.databaseBridge.find(tag:tag,table:table,id:id,resolve:resolve,reject:reject)
        }
    }

    @objc(query:table:query:resolve:reject:)
    func query(tag: NSNumber,
               table: String,
               query: String,
               resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        databaseBridge.methodQueue.async { [weak self] in
            self?.databaseBridge.query(tag:tag,table:table,query:query,resolve:resolve,reject:reject)
        }
    }

    @objc(count:query:resolve:reject:)
    func count(tag: NSNumber,
               query: String,
               resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        databaseBridge.methodQueue.async { [weak self] in
            self?.databaseBridge.count(tag:tag,query:query,resolve:resolve,reject:reject)
        }
    }

    @objc(batch:operations:resolve:reject:)
    func batch(tag: NSNumber,
               operations: [[Any]],
               resolve: @escaping RCTPromiseResolveBlock,
               reject: @escaping RCTPromiseRejectBlock) {
        databaseBridge.methodQueue.async { [weak self] in
            self?.databaseBridge.batch(tag:tag,operations:operations,resolve:resolve,reject:reject)
        }
    }

    @objc(getDeletedRecords:table:resolve:reject:)
    func getDeletedRecords(tag: NSNumber,
                           table: String,
                           resolve: @escaping RCTPromiseResolveBlock,
                           reject: @escaping RCTPromiseRejectBlock) {
        databaseBridge.methodQueue.async { [weak self] in
            self?.databaseBridge.getDeletedRecords(tag:tag,table:table,resolve:resolve,reject:reject)
        }
    }

    @objc(destroyDeletedRecords:table:records:resolve:reject:)
    func destroyDeletedRecords(tag: NSNumber,
                               table: String,
                               records: [String],
                               resolve: @escaping RCTPromiseResolveBlock,
                               reject: @escaping RCTPromiseRejectBlock) {
        databaseBridge.methodQueue.async { [weak self] in
            self?.databaseBridge.destroyDeletedRecords(tag:tag,table:table,records:records,resolve:resolve,reject:reject)
        }
    }

    @objc(unsafeResetDatabase:schema:schemaVersion:resolve:reject:)
    func unsafeResetDatabase(tag: NSNumber,
                             schema: String,
                             schemaVersion: NSNumber,
                             resolve: @escaping RCTPromiseResolveBlock,
                             reject: @escaping RCTPromiseRejectBlock) {
        databaseBridge.methodQueue.async { [weak self] in
            self?.databaseBridge.unsafeResetDatabase(tag:tag,schema:schema,schemaVersion:schemaVersion,resolve:resolve,reject:reject)
        }
    }

    @objc(getLocal:key:resolve:reject:)
    func getLocal(tag: NSNumber, key: String,
                  resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        databaseBridge.methodQueue.async { [weak self] in
            self?.databaseBridge.getLocal(tag:tag,key:key,resolve:resolve,reject:reject)
        }
    }

    @objc(setLocal:key:value:resolve:reject:)
    func setLocal(tag: NSNumber,
                  key: String,
                  value: String,
                  resolve: @escaping RCTPromiseResolveBlock,
                  reject: @escaping RCTPromiseRejectBlock) {
        databaseBridge.methodQueue.async { [weak self] in
            self?.databaseBridge.setLocal(tag: tag, key:key,value:value,resolve:resolve,reject:reject)
        }
    }

    @objc(removeLocal:key:resolve:reject:)
    func removeLocal(tag: NSNumber, key: String,
                     resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        databaseBridge.methodQueue.async { [weak self] in
            self?.databaseBridge.removeLocal(tag:tag,key:key,resolve:resolve,reject:reject)
        }
    }
}
