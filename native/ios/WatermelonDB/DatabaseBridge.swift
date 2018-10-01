import Foundation

@objc(DatabaseBridge)
final public class DatabaseBridge: NSObject {
    typealias ConnectionTag = NSNumber
    @objc static let requiresMainQueueSetup: Bool = false
    @objc let methodQueue = DispatchQueue(label: "com.nozbe.watermelondb.database", qos: .userInteractive)
    var connections: [Int: DatabaseDriver] = [:]

    @objc(setUp:databaseName:schema:schemaVersion:resolve:reject:)
    func setUp(tag: ConnectionTag,
               databaseName: String,
               schema: Database.SQL,
               schemaVersion: NSNumber,
               resolve: RCTPromiseResolveBlock,
               reject: RCTPromiseRejectBlock) {
        assert(connections[tag.intValue] == nil, "A driver with tag \(tag) already set up")
        do {
            let driver = try DatabaseDriver(configuration:
                DatabaseDriver.Configuration(dbName: databaseName,
                                             schema: schema,
                                             schemaVersion: schemaVersion.intValue)
            )
            connections[tag.intValue] = driver
            resolve(true)
        } catch let error as DatabaseDriver.SchemaNeededError {
            // TODO
        } catch let error as DatabaseDriver.MigrationNeededError {
            // TODO
        } catch {
            assertionFailure("Unknown error thrown in DatabaseDriver.init")
            sendReject(reject, error)
        }
    }

    @objc(find:table:id:resolve:reject:)
    func find(tag: ConnectionTag,
              table: Database.TableName,
              id: DatabaseDriver.RecordId,
              resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.find(table: table, id: id) as Any
        }
    }

    @objc(query:query:resolve:reject:)
    func query(tag: ConnectionTag,
               query: Database.SQL, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.cachedQuery(query)
        }
    }

    @objc(count:query:resolve:reject:)
    func count(tag: ConnectionTag,
               query: Database.SQL,
               resolve: RCTPromiseResolveBlock,
               reject: RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.count(query)
        }
    }

    @objc(batch:operations:resolve:reject:)
    func batch(tag: ConnectionTag,
               operations: [[Any]],
               resolve: RCTPromiseResolveBlock,
               reject: RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.batch(operations.map { operation in
                switch operation[safe: 0] as? String {
                case "execute":
                    guard let query = operation[safe: 1] as? Database.SQL,
                    let args = operation[safe: 2] as? Database.QueryArgs
                    else {
                        throw "Bad execute arguments".asError()
                    }

                    return .execute(query: query, args: args)

                case "create":
                    guard let id = operation[safe: 1] as? DatabaseDriver.RecordId,
                    let query = operation[safe: 2] as? Database.SQL,
                    let args = operation[safe: 3] as? Database.QueryArgs
                    else {
                        throw "Bad create arguments".asError()
                    }

                    return .create(id: id, query: query, args: args)

                case "markAsDeleted":
                    guard let table = operation[safe: 1] as? Database.SQL,
                    let id = operation[safe: 2] as? DatabaseDriver.RecordId
                    else {
                        throw "Bad markAsDeleted arguments".asError()
                    }

                    return .markAsDeleted(table: table, id: id)

                case "destroyPermanently":
                    guard let table = operation[safe: 1] as? Database.SQL,
                    let id = operation[safe: 2] as? DatabaseDriver.RecordId
                    else {
                        throw "Bad destroyPermanently arguments".asError()
                    }

                    return .destroyPermanently(table: table, id: id)
                default:
                    throw "Bad operation name".asError()
                }
            })
        }
    }

    @objc(getDeletedRecords:table:resolve:reject:)
    func getDeletedRecords(tag: ConnectionTag,
                           table: Database.TableName,
                           resolve: RCTPromiseResolveBlock,
                           reject: RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.getDeletedRecords(table: table)
        }
    }

    @objc(destroyDeletedRecords:table:records:resolve:reject:)
    func destroyDeletedRecords(tag: ConnectionTag,
                               table: Database.TableName,
                               records: [DatabaseDriver.RecordId],
                               resolve: RCTPromiseResolveBlock,
                               reject: RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.destroyDeletedRecords(table: table, records: records)
        }
    }

    @objc(unsafeResetDatabase:resolve:reject:)
    func unsafeResetDatabase(tag: ConnectionTag, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.unsafeResetDatabase()
        }
    }

    @objc(getLocal:key:resolve:reject:)
    func getLocal(tag: ConnectionTag, key: String, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.getLocal(key: key) as Any
        }
    }

    @objc(setLocal:key:value:resolve:reject:)
    func setLocal(tag: ConnectionTag,
                  key: String,
                  value: String,
                  resolve: RCTPromiseResolveBlock,
                  reject: RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.setLocal(key: key, value: value)
        }
    }

    @objc(removeLocal:key:resolve:reject:)
    func removeLocal(tag: ConnectionTag, key: String, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.removeLocal(key: key)
        }
    }

    @objc(unsafeClearCachedRecords:resolve:reject:)
    func unsafeClearCachedRecords(tag: ConnectionTag, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            $0.unsafeClearCachedRecords()
        }
    }

    private func withDriver(_ connectionTag: ConnectionTag,
                            _ resolve: RCTPromiseResolveBlock,
                            _ reject: RCTPromiseRejectBlock,
                            functionName: String = #function,
                            action: (DatabaseDriver) throws -> Any) {
        do {
            guard let driver = connections[connectionTag.intValue] else {
                // TODO: Add waiting logic
                throw "No driver for with tag \(connectionTag) available".asError()
            }

            let result = try action(driver)
            resolve(result)
        } catch {
            sendReject(reject, error, functionName: functionName)
        }
    }

    private func sendReject(_ reject: RCTPromiseRejectBlock,
                            _ error: Error,
                            functionName: String = #function) {
        reject("db.\(functionName).error", error.localizedDescription, error)
    }
}
