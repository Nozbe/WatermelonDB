import Foundation

@objc(DatabaseBridge)
final public class DatabaseBridge: NSObject {
    typealias ConnectionTag = NSNumber
    @objc static let requiresMainQueueSetup: Bool = false
    @objc let methodQueue = DispatchQueue(label: "com.nozbe.watermelondb.database", qos: .userInteractive)

    private enum Connection {
        case connected(driver: DatabaseDriver)
        case waiting(queue: [() -> Void])
    }
    private var connections: [Int: Connection] = [:]

    @objc(setUp:databaseName:schema:schemaVersion:resolve:reject:)
    func setUp(tag: ConnectionTag,
               databaseName: String,
               schema: Database.SQL,
               schemaVersion: NSNumber,
               resolve: RCTPromiseResolveBlock,
               reject: RCTPromiseRejectBlock) {
        assert(connections[tag.intValue] == nil, "A driver with tag \(tag) already set up")

        do {
            let driver = try DatabaseDriver(dbName: databaseName, schemaVersion: schemaVersion.intValue)
            connections[tag.intValue] = .connected(driver: driver)
            resolve(true)
        } catch _ as DatabaseDriver.SchemaNeededError {
            consoleLog("Schema needed!")

            let driver = DatabaseDriver(dbName: databaseName, setUpWithSchema: (version: schemaVersion.intValue, sql: schema))
            connections[tag.intValue] = .connected(driver: driver)
            resolve(true)
            // TODO: send to js
        } catch let error as DatabaseDriver.MigrationNeededError {
            // TODO: migrations
            let databaseVersion = error.databaseVersion
            consoleLog("Migrations needed! from: \(databaseVersion)")
            let driver = DatabaseDriver(dbName: databaseName, setUpWithSchema: (version: schemaVersion.intValue, sql: schema))
            connections[tag.intValue] = .connected(driver: driver)
            resolve(true)
        } catch {
            assertionFailure("Unknown error thrown in DatabaseDriver.init")
            sendReject(reject, error)
        }
    }

    @objc(find:table:id:resolve:reject:)
    func find(tag: ConnectionTag,
              table: Database.TableName,
              id: DatabaseDriver.RecordId,
              resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.find(table: table, id: id) as Any
        }
    }

    @objc(query:query:resolve:reject:)
    func query(tag: ConnectionTag,
               query: Database.SQL,
               resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.cachedQuery(query)
        }
    }

    @objc(count:query:resolve:reject:)
    func count(tag: ConnectionTag,
               query: Database.SQL,
               resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.count(query)
        }
    }

    @objc(batch:operations:resolve:reject:)
    func batch(tag: ConnectionTag,
               operations: [[Any]],
               resolve: @escaping RCTPromiseResolveBlock,
               reject: @escaping RCTPromiseRejectBlock) {
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
                           resolve: @escaping RCTPromiseResolveBlock,
                           reject: @escaping RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.getDeletedRecords(table: table)
        }
    }

    @objc(destroyDeletedRecords:table:records:resolve:reject:)
    func destroyDeletedRecords(tag: ConnectionTag,
                               table: Database.TableName,
                               records: [DatabaseDriver.RecordId],
                               resolve: @escaping RCTPromiseResolveBlock,
                               reject: @escaping RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.destroyDeletedRecords(table: table, records: records)
        }
    }

    @objc(unsafeResetDatabase:schema:schemaVersion:resolve:reject:)
    func unsafeResetDatabase(tag: ConnectionTag,
                             schema: Database.SQL,
                             schemaVersion: NSNumber,
                               resolve: @escaping RCTPromiseResolveBlock,
                               reject: @escaping RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.unsafeResetDatabase(schema: (version: schemaVersion.intValue, sql: schema))
        }
    }

    @objc(getLocal:key:resolve:reject:)
    func getLocal(tag: ConnectionTag, key: String,
                   resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.getLocal(key: key) as Any
        }
    }

    @objc(setLocal:key:value:resolve:reject:)
    func setLocal(tag: ConnectionTag,
                  key: String,
                  value: String,
                  resolve: @escaping RCTPromiseResolveBlock,
                  reject: @escaping RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.setLocal(key: key, value: value)
        }
    }

    @objc(removeLocal:key:resolve:reject:)
    func removeLocal(tag: ConnectionTag, key: String,
                     resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.removeLocal(key: key)
        }
    }

    @objc(unsafeClearCachedRecords:resolve:reject:)
    func unsafeClearCachedRecords(tag: ConnectionTag,
                                  resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            $0.unsafeClearCachedRecords()
        }
    }

    private func withDriver(_ connectionTag: ConnectionTag,
                            _ resolve: @escaping RCTPromiseResolveBlock,
                            _ reject: @escaping RCTPromiseRejectBlock,
                            functionName: String = #function,
                            action: @escaping (DatabaseDriver) throws -> Any) {
        do {
            let tagID = connectionTag.intValue
            guard let connection = connections[tagID] else {
                throw "No driver for with tag \(connectionTag) available".asError()
            }

            switch connection {
            case .connected(let driver):
                let result = try action(driver)
                resolve(result)
            case .waiting(var queue):
                // try again when driver is ready
                queue.append {
                    self.withDriver(connectionTag, resolve, reject, functionName: functionName, action: action)
                }
                connections[tagID] = .waiting(queue: queue)
            }
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
