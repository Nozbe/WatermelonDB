import Foundation

@objc(DatabaseBridge)
final public class DatabaseBridge: NSObject {
    typealias ConnectionTag = NSNumber

    @objc var bridge: RCTBridge?
    @objc static let requiresMainQueueSetup: Bool = false
    @objc let methodQueue = DispatchQueue(label: "com.nozbe.watermelondb.database", qos: .userInteractive)

    private enum Connection {
        case connected(driver: DatabaseDriver)
        case waiting(queue: [() -> Void])

        var queue: [() -> Void] {
            switch self {
            case .connected(driver: _): return []
            case .waiting(queue: let queue): return queue
            }
        }
    }
    private var connections: [Int: Connection] = [:]
}

// MARK: - Asynchronous connections

extension DatabaseBridge {
    @objc(initialize:databaseName:schemaVersion:resolve:reject:)
    func initialize(tag: ConnectionTag,
                    databaseName: String,
                    schemaVersion: NSNumber,
                    resolve: RCTPromiseResolveBlock,
                    reject: RCTPromiseRejectBlock) {
        do {
            try assertNoConnection(tag)
            let driver = try DatabaseDriver(dbName: databaseName, schemaVersion: schemaVersion.intValue)
            connections[tag.intValue] = .connected(driver: driver)
            resolve(["code": "ok"])
        } catch _ as DatabaseDriver.SchemaNeededError {
            connections[tag.intValue] = .waiting(queue: [])
            resolve(["code": "schema_needed"])
        } catch let error as DatabaseDriver.MigrationNeededError {
            connections[tag.intValue] = .waiting(queue: [])
            resolve(["code": "migrations_needed", "databaseVersion": error.databaseVersion])
        } catch {
            assertionFailure("Unknown error thrown in DatabaseDriver.init")
            sendReject(reject, error)
        }
    }

    @objc(setUpWithSchema:databaseName:schema:schemaVersion:resolve:reject:)
    func setUpWithSchema(tag: ConnectionTag,
                         databaseName: String,
                         schema: Database.SQL,
                         schemaVersion: NSNumber,
                         resolve: RCTPromiseResolveBlock,
                         reject: RCTPromiseRejectBlock) {
        let driver = DatabaseDriver(dbName: databaseName,
                                    setUpWithSchema: (version: schemaVersion.intValue, sql: schema))
        connectDriverAsync(connectionTag: tag, driver: driver)
        resolve(true)
    }

    @objc(setUpWithMigrations:databaseName:migrations:fromVersion:toVersion:resolve:reject:)
    func setUpWithMigrations(tag: ConnectionTag, // swiftlint:disable:this function_parameter_count
                             databaseName: String,
                             migrations: Database.SQL,
                             fromVersion: NSNumber,
                             toVersion: NSNumber,
                             resolve: RCTPromiseResolveBlock,
                             reject: RCTPromiseRejectBlock) {
        do {
            let driver = try DatabaseDriver(
                dbName: databaseName,
                setUpWithMigrations: (from: fromVersion.intValue, to: toVersion.intValue, sql: migrations)
            )
            connectDriverAsync(connectionTag: tag, driver: driver)
            resolve(true)
        } catch {
            disconnectDriver(tag)
            sendReject(reject, error)
        }
    }
}

// MARK: - JSI Support

extension DatabaseBridge {
    @objc(initializeJSI)
    func initializeJSI() -> NSDictionary {
        methodQueue.sync {
            // swiftlint:disable all
            installWatermelonJSI(bridge as? RCTCxxBridge)
        }
        return [:]
    }
    
    @objc(provideSyncJson:json:resolve:reject:)
    func provideSyncJson(id: NSNumber,
                         json: NSString,
                         resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        var error: NSError?
        watermelondbProvideSyncJson(id.int32Value, json.data(using: String.Encoding.utf8.rawValue), &error)
        if let error = error {
            sendReject(reject, error)
        } else {
            resolve(true)
        }
    }
}

// MARK: - Asynchronous actions

extension DatabaseBridge {
    @objc(find:table:id:resolve:reject:)
    func find(tag: ConnectionTag,
              table: Database.TableName,
              id: DatabaseDriver.RecordId,
              resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.find(table: table, id: id) as Any
        }
    }

    @objc(query:table:query:args:resolve:reject:)
    func query(tag: ConnectionTag,
               table: Database.TableName,
               query: Database.SQL,
               args: Database.QueryArgs,
               resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.cachedQuery(table: table, query: query, args: args)
        }
    }

    @objc(queryIds:query:args:resolve:reject:)
    func queryIds(tag: ConnectionTag,
               query: Database.SQL,
               args: Database.QueryArgs,
               resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.queryIds(query: query, args: args)
        }
    }

    @objc(unsafeQueryRaw:query:args:resolve:reject:)
    func unsafeQueryRaw(tag: ConnectionTag,
               query: Database.SQL,
               args: Database.QueryArgs,
               resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.unsafeQueryRaw(query: query, args: args)
        }
    }

    @objc(count:query:args:resolve:reject:)
    func count(tag: ConnectionTag,
               query: Database.SQL,
               args: Database.QueryArgs,
               resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.count(query, args: args)
        }
    }

    @objc(batchJSON:operations:resolve:reject:)
    func batchJSON(tag: ConnectionTag,
                   operations serializedOperations: NSString,
                   resolve: @escaping RCTPromiseResolveBlock,
                   reject: @escaping RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.batch(self.toBatchOperations(serializedOperations))
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
}

// MARK: - Helpers

extension DatabaseBridge {
    private func toBatchOperations(_ serializedOperations: NSString) throws -> [DatabaseDriver.Operation] {
        guard let data = serializedOperations.data(using: String.Encoding.utf8.rawValue),
        let operations = (try? JSONSerialization.jsonObject(with: data)) as? [[Any]]
        else {
            throw "Invalid serialized operations".asError()
        }

        return try toBatchOperations(operations)
    }

    private func toBatchOperations(_ operations: [[Any]]) throws -> [DatabaseDriver.Operation] {
        return try operations.map { operation in
            guard let cacheMode = operation[safe: 0] as? Int,
                  let sql = operation[safe: 2] as? Database.SQL,
                  let argBatches = operation[safe: 3] as? [Database.QueryArgs]
            else {
                throw "bad batch arguments".asError()
            }

            let table = operation[safe: 1] as? String

            let cacheBehavior: DatabaseDriver.CacheBehavior
            switch cacheMode {
            case 0:
                cacheBehavior = .ignore
            case 1:
                cacheBehavior = .addFirstArg(table: table!)
            case -1:
                cacheBehavior = .removeFirstArg(table: table!)
            default:
                throw "bad cache behavior".asError()
            }

            return DatabaseDriver.Operation(cacheBehavior: cacheBehavior, sql: sql, argBatches: argBatches)
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
                consoleLog("Operation for driver \(tagID) enqueued")
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

    private func connectDriverAsync(connectionTag: ConnectionTag, driver: DatabaseDriver) {
        let tagID = connectionTag.intValue
        let queue = connections[tagID]?.queue ?? []
        connections[tagID] = .connected(driver: driver)

        for operation in queue {
            operation()
        }
    }

    private func disconnectDriver(_ connectionTag: ConnectionTag) {
        let tagID = connectionTag.intValue
        let queue = connections[tagID]?.queue ?? []
        connections[tagID] = nil

        for operation in queue {
            operation()
        }
    }

    private func assertNoConnection(_ tag: NSNumber) throws {
        guard connections[tag.intValue] == nil else {
            throw "A driver with tag \(tag) already set up".asError()
        }
    }

    private func sendReject(_ reject: RCTPromiseRejectBlock,
                            _ error: Error,
                            functionName: String = #function) {
        reject("db.\(functionName).error", "\(error)", error)
    }
}
