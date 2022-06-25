import Foundation

@objc(DatabaseBridge)
final public class DatabaseBridge: NSObject {
    typealias ConnectionTag = NSNumber

    @objc var bridge: RCTBridge?
    @objc static let requiresMainQueueSetup: Bool = false
    @objc let methodQueue = DispatchQueue(label: "com.nozbe.watermelondb.database", qos: .userInteractive)

    private enum Connection {
        case connected(driver: DatabaseDriver, synchronous: Bool)
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
            connections[tag.intValue] = .connected(driver: driver, synchronous: false)
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

// MARK: - Synchronous connections

extension DatabaseBridge {
    @objc(initializeJSI)
    func initializeJSI() -> NSDictionary {
        return synchronously {
            // swiftlint:disable all
            installWatermelonJSI(bridge as? RCTCxxBridge)
        }
    }

    @objc(initializeSynchronous:databaseName:schemaVersion:)
    func initializeSynchronous(tag: ConnectionTag,
                               databaseName: String,
                               schemaVersion: NSNumber) -> NSDictionary {
        return synchronously {
            do {
                try assertNoConnection(tag)
                let driver = try DatabaseDriver(dbName: databaseName, schemaVersion: schemaVersion.intValue)
                connections[tag.intValue] = .connected(driver: driver, synchronous: true)
                return ["code": "ok"]
            } catch _ as DatabaseDriver.SchemaNeededError {
                return ["code": "schema_needed"]
            } catch let error as DatabaseDriver.MigrationNeededError {
                return ["code": "migrations_needed", "databaseVersion": error.databaseVersion]
            } catch {
                assertionFailure("Unknown error thrown in DatabaseDriver.init")
                throw error // rethrow
            }
        }
    }

    @objc(setUpWithSchemaSynchronous:databaseName:schema:schemaVersion:)
    func setUpWithSchemaSynchronous(tag: ConnectionTag,
                                    databaseName: String,
                                    schema: Database.SQL,
                                    schemaVersion: NSNumber) -> NSDictionary {
        return synchronously {
            try assertNoConnection(tag)
            let driver = DatabaseDriver(dbName: databaseName,
                                        setUpWithSchema: (version: schemaVersion.intValue, sql: schema))
            connections[tag.intValue] = .connected(driver: driver, synchronous: true)
            return true
        }
    }

    @objc(setUpWithMigrationsSynchronous:databaseName:migrations:fromVersion:toVersion:)
    func setUpWithMigrationsSynchronous(tag: ConnectionTag,
                                        databaseName: String,
                                        migrations: Database.SQL,
                                        fromVersion: NSNumber,
                                        toVersion: NSNumber) -> NSDictionary {
        return synchronously {
            try assertNoConnection(tag)
            let driver = try DatabaseDriver(
                dbName: databaseName,
                setUpWithMigrations: (from: fromVersion.intValue, to: toVersion.intValue, sql: migrations)
            )
            connections[tag.intValue] = .connected(driver: driver, synchronous: true)
            return true
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

    @objc(query:table:query:resolve:reject:)
    func query(tag: ConnectionTag,
               table: Database.TableName,
               query: Database.SQL,
               resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.cachedQuery(table: table, query: query)
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

    @objc(batchJSON:operations:resolve:reject:)
    func batchJSON(tag: ConnectionTag,
                   operations serializedOperations: NSString,
                   resolve: @escaping RCTPromiseResolveBlock,
                   reject: @escaping RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.batch(self.toBatchOperations(serializedOperations))
        }
    }

    @objc(batch:operations:resolve:reject:)
    func batch(tag: ConnectionTag,
               operations: [[Any]],
               resolve: @escaping RCTPromiseResolveBlock,
               reject: @escaping RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
            try $0.batch(self.toBatchOperations(operations))
        }
    }

    @objc(copyTables:tables:srcDB:resolve:reject:)
    func copyTables(tag: ConnectionTag,
                    tables: [String],
                    srcDB: String,
                    resolve: @escaping RCTPromiseResolveBlock,
                    reject: @escaping RCTPromiseRejectBlock) {
        withDriver(tag, resolve, reject) {
           try $0.copyTables(tables, srcDB: srcDB)
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
}

// MARK: - Synchronous methods

extension DatabaseBridge {
    @objc(findSynchronous:table:id:)
    func findSynchronous(tag: ConnectionTag, table: Database.TableName, id: DatabaseDriver.RecordId) -> NSDictionary {
        return withDriverSynchronous(tag) {
            try $0.find(table: table, id: id) as Any
        }
    }

    @objc(querySynchronous:table:query:)
    func querySynchronous(tag: ConnectionTag, table: Database.TableName, query: Database.SQL) -> NSDictionary {
        return withDriverSynchronous(tag) {
            try $0.cachedQuery(table: table, query: query)
        }
    }

    @objc(countSynchronous:query:)
    func countSynchronous(tag: ConnectionTag, query: Database.SQL) -> NSDictionary {
        return withDriverSynchronous(tag) {
            try $0.count(query)
        }
    }

    @objc(copyTablesSynchronous:tables:srcDB:)
    func copyTables(tag: ConnectionTag, tables: [String], srcDB: String) -> NSDictionary {
        return withDriverSynchronous(tag) {
            try $0.copyTables(tables, srcDB: srcDB)
        }
    }
    
    @objc(batchJSONSynchronous:operations:)
    func batchJSONSynchronous(tag: ConnectionTag, operations serializedOperations: NSString) -> NSDictionary {
        return withDriverSynchronous(tag) {
            try $0.batch(self.toBatchOperations(serializedOperations))
        }
    }

    @objc(batchSynchronous:operations:)
    func batchSynchronous(tag: ConnectionTag, operations: [[Any]]) -> NSDictionary {
        return withDriverSynchronous(tag) {
            try $0.batch(self.toBatchOperations(operations))
        }
    }

    @objc(getDeletedRecordsSynchronous:table:)
    func getDeletedRecordsSynchronous(tag: ConnectionTag, table: Database.TableName) -> NSDictionary {
        return withDriverSynchronous(tag) {
            try $0.getDeletedRecords(table: table)
        }
    }

    @objc(destroyDeletedRecordsSynchronous:table:records:)
    func destroyDeletedRecordsSynchronous(tag: ConnectionTag,
                                          table: Database.TableName,
                                          records: [DatabaseDriver.RecordId]) -> NSDictionary {
        return withDriverSynchronous(tag) {
            try $0.destroyDeletedRecords(table: table, records: records)
        }
    }

    @objc(unsafeResetDatabaseSynchronous:schema:schemaVersion:)
    func unsafeResetDatabaseSynchronous(tag: ConnectionTag,
                                        schema: Database.SQL,
                                        schemaVersion: NSNumber) -> NSDictionary {
        return withDriverSynchronous(tag) {
            try $0.unsafeResetDatabase(schema: (version: schemaVersion.intValue, sql: schema))
        }
    }

    @objc(getLocalSynchronous:key:)
    func getLocalSynchronous(tag: ConnectionTag, key: String) -> NSDictionary {
        return withDriverSynchronous(tag) {
            try $0.getLocal(key: key) as Any
        }
    }

    @objc(setLocalSynchronous:key:value:)
    func setLocalSynchronous(tag: ConnectionTag, key: String, value: String) -> NSDictionary {
        return withDriverSynchronous(tag) {
            try $0.setLocal(key: key, value: value)
        }
    }

    @objc(removeLocalSynchronous:key:)
    func removeLocalSynchronous(tag: ConnectionTag, key: String) -> NSDictionary {
        return withDriverSynchronous(tag) {
            try $0.removeLocal(key: key)
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
            switch operation[safe: 0] as? String {
            case "execute":
                guard let table = operation[safe: 1] as? Database.TableName,
                let query = operation[safe: 2] as? Database.SQL,
                let args = operation[safe: 3] as? Database.QueryArgs
                else {
                    throw "Bad execute arguments".asError()
                }

                return .execute(table: table, query: query, args: args)

            case "create":
                guard let table = operation[safe: 1] as? Database.TableName,
                let id = operation[safe: 2] as? DatabaseDriver.RecordId,
                let query = operation[safe: 3] as? Database.SQL,
                let args = operation[safe: 4] as? Database.QueryArgs
                else {
                    throw "Bad create arguments".asError()
                }

                return .create(table: table, id: id, query: query, args: args)

            case "markAsDeleted":
                guard let table = operation[safe: 1] as? Database.SQL,
                let id = operation[safe: 2] as? DatabaseDriver.RecordId
                else {
                    throw "Bad markAsDeleted arguments".asError()
                }

                return .markAsDeleted(table: table, id: id)

            case "destroyPermanently":
                guard let table = operation[safe: 1] as? Database.TableName,
                let id = operation[safe: 2] as? DatabaseDriver.RecordId
                else {
                    throw "Bad destroyPermanently arguments".asError()
                }

                return .destroyPermanently(table: table, id: id)

            case "copy":
                guard let table = operation[safe: 1] as? Database.TableName,
                let attachPath = operation[safe: 2] as? String
                else {
                    throw "Bad copy arguments".asError()
                }
                return .copy(table: table, attachPath: attachPath)

            default:
                throw "Bad operation name".asError()
            }
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
            case .connected(let driver, let synchronous):
                guard !synchronous else {
                    throw "Can't perform async action on synchronous connection \(tagID)".asError()
                }
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

    private func synchronously(functionName: String = #function, action: () throws -> Any) -> NSDictionary {
        return methodQueue.sync {
            do {
                let result = try action()
                return ["status": "success", "result": result]
            } catch {
                return ["status": "error", "code": "db.\(functionName).error", "message": "\(error)"]
            }
        }
    }

    private func withDriverSynchronous(_ connectionTag: ConnectionTag,
                                       functionName: String = #function,
                                       action: (DatabaseDriver) throws -> Any) -> NSDictionary {
        return synchronously {
            guard let connection = connections[connectionTag.intValue],
            case let .connected(driver, synchronous: true) = connection else {
                throw "No or invalid connection for tag \(connectionTag)".asError()
            }

            return try action(driver)
        }
    }

    private func connectDriverAsync(connectionTag: ConnectionTag, driver: DatabaseDriver) {
        let tagID = connectionTag.intValue
        let queue = connections[tagID]?.queue ?? []
        connections[tagID] = .connected(driver: driver, synchronous: false)

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
