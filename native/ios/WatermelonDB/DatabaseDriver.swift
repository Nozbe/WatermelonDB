import Foundation

class DatabaseDriver {
    typealias SchemaVersion = Int
    typealias Schema = (version: SchemaVersion, sql: Database.SQL)
    typealias MigrationSet = (from: SchemaVersion, to: SchemaVersion, sql: Database.SQL)

    struct SchemaNeededError: Error { }
    struct MigrationNeededError: Error {
        let databaseVersion: SchemaVersion
    }

    let database: Database

    convenience init(dbName: String, schemaVersion: SchemaVersion) throws {
        self.init(dbName: dbName)

        switch isCompatible(withVersion: schemaVersion) {
        case .compatible: break
        case .needsSetup:
            throw SchemaNeededError()
        case .needsMigration(fromVersion: let dbVersion):
            throw MigrationNeededError(databaseVersion: dbVersion)
        }
    }

    convenience init(dbName: String, setUpWithSchema schema: Schema) {
        self.init(dbName: dbName)

        do {
            try unsafeResetDatabase(schema: schema)
        } catch {
            fatalError("Error while setting up the database: \(error)")
        }
    }

    convenience init(dbName: String, setUpWithMigrations migrations: MigrationSet) throws {
        self.init(dbName: dbName)
        try migrate(with: migrations)
    }

    private init(dbName: String) {
        self.database = Database(path: getPath(dbName: dbName))
    }

    func find(table: Database.TableName, id: RecordId) throws -> Any? {
        guard !isCached(table, id) else {
            return id
        }

        let results = try database.queryRaw("select * from `\(table)` where id == ? limit 1", [id])

        guard let record = results.next() else {
            return nil
        }

        markAsCached(table, id)
        return record.resultDictionary!
    }

    func cachedQuery(table: Database.TableName, query: Database.SQL, args: Database.QueryArgs = []) throws -> [Any] {
        return try database.queryRaw(query, args).map { row in
            let id = row.string(forColumn: "id")!

            if isCached(table, id) {
                return id
            } else {
                markAsCached(table, id)
                return row.resultDictionary!
            }
        }
    }

    func queryIds(query: Database.SQL, args: Database.QueryArgs = []) throws -> [String] {
        return try database.queryRaw(query, args).map { row in
            row.string(forColumn: "id")!
        }
    }

    func count(_ query: Database.SQL, args: Database.QueryArgs = []) throws -> Int {
        return try database.count(query, args)
    }

    enum CacheBehavior {
        case ignore
        case addFirstArg(table: Database.TableName)
        case removeFirstArg(table: Database.TableName)
    }

    struct Operation {
        let cacheBehavior: CacheBehavior
        let sql: Database.SQL
        let argBatches: [Database.QueryArgs]
    }

    func batch(_ operations: [Operation]) throws {
        var newIds: [(Database.TableName, RecordId)] = []
        var removedIds: [(Database.TableName, RecordId)] = []

        try database.inTransaction {
            for operation in operations {
                for args in operation.argBatches {
                    try database.execute(operation.sql, args)

                    switch operation.cacheBehavior {
                    case .addFirstArg(table: let table):
                        // swiftlint:disable:next force_cast
                        newIds.append((table, id: args[0] as! String))
                    case .removeFirstArg(table: let table):
                        // swiftlint:disable:next force_cast
                        removedIds.append((table, id: args[0] as! String))
                    case .ignore:
                        break
                    }
                }
            }
        }

        for (table, id) in newIds {
            markAsCached(table, id)
        }

        for (table, id) in removedIds {
            removeFromCache(table, id)
        }
    }

// MARK: - LocalStorage

    func getLocal(key: String) throws -> String? {
        let results = try database.queryRaw("select `value` from `local_storage` where `key` = ?", [key])

        guard let record = results.next() else {
            return nil
        }

        return record.string(forColumn: "value")!
    }

// MARK: - Record caching

    typealias RecordId = String

    // Rewritten to use good ol' mutable Objective C for performance
    // The swifty implementation in debug took >100s to execute on a 65K batch. This: 6ms. Yes. Really.
    private var cachedRecords: NSMutableDictionary /* [TableName: Set<RecordId>] */ = NSMutableDictionary()

    func isCached(_ table: Database.TableName, _ id: RecordId) -> Bool {
        if let set = cachedRecords[table] as? NSSet {
            return set.contains(id)
        }
        return false
    }

    private func markAsCached(_ table: Database.TableName, _ id: RecordId) {
        var cachedSet: NSMutableSet
        if let set = cachedRecords[table] as? NSMutableSet {
            cachedSet = set
        } else {
            cachedSet = NSMutableSet()
            cachedRecords[table] = cachedSet
        }
        cachedSet.add(id)
    }

    private func removeFromCache(_ table: Database.TableName, _ id: RecordId) {
        if let set = cachedRecords[table] as? NSMutableSet {
            set.remove(id)
        }
    }

// MARK: - Other private details

    private enum SchemaCompatibility {
        case compatible
        case needsSetup
        case needsMigration(fromVersion: SchemaVersion)
    }

    private func isCompatible(withVersion schemaVersion: SchemaVersion) -> SchemaCompatibility {
        let databaseVersion = database.userVersion

        switch databaseVersion {
        case schemaVersion: return .compatible
        case 0: return .needsSetup
        case (1..<schemaVersion): return .needsMigration(fromVersion: databaseVersion)
        default:
            consoleLog("Database has newer version (\(databaseVersion)) than what the " +
                "app supports (\(schemaVersion)). Will reset database.")
            return .needsSetup
        }
    }

    func unsafeResetDatabase(schema: Schema) throws {
        try database.unsafeDestroyEverything()
        cachedRecords = [:]

        try setUpSchema(schema: schema)
    }

    private func setUpSchema(schema: Schema) throws {
        try database.inTransaction {
            try database.executeStatements(schema.sql)
            database.userVersion = schema.version
        }
    }

    private func migrate(with migrations: MigrationSet) throws {
        precondition(
            database.userVersion == migrations.from,
            "Incompatbile migration set applied. DB: \(database.userVersion), migration: \(migrations.from)"
        )

        try database.inTransaction {
            try database.executeStatements(migrations.sql)
            database.userVersion = migrations.to
        }
    }
}

private func getPath(dbName: String) -> String {
    // If starts with `file:` or contains `/`, it's a path!
    if dbName.starts(with: "file:") || dbName.contains("/") {
        return dbName
    } else {
        // swiftlint:disable:next force_try
        return try! FileManager.default
            .url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: false)
            .appendingPathComponent("\(dbName).db")
            .path
    }
}
