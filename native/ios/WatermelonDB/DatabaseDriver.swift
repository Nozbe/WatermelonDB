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
        // swiftlint:disable:next force_try
        let path = try! FileManager.default
            .url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: false)
            .appendingPathComponent("\(dbName).db")
            .path

        // In test env, pass name of memory db
        self.database = Database(path: isTestRunning ? dbName : path)
    }

    func find(table: Database.TableName, id: RecordId) throws -> Any? {
        guard !isCached(table, id) else {
            return id
        }

        let results = try database.queryRaw("select * from \(table) where id == ? limit 1", [id])

        guard let record = results.next() else {
            return nil
        }

        markAsCached(table, id)
        return record.resultDictionary!
    }

    func cachedQuery(table: Database.TableName, query: Database.SQL) throws -> [Any] {
        return try database.queryRaw(query).map { row in
            let id = row.string(forColumn: "id")!

            if isCached(table, id) {
                return id
            } else {
                markAsCached(table, id)
                return row.resultDictionary!
            }
        }
    }

    func count(_ query: Database.SQL) throws -> Int {
        return try database.count(query)
    }

    enum Operation {
        case execute(table: Database.TableName, query: Database.SQL, args: Database.QueryArgs)
        case create(table: Database.TableName, id: RecordId, query: Database.SQL, args: Database.QueryArgs)
        case destroyPermanently(table: Database.TableName, id: RecordId)
        case markAsDeleted(table: Database.TableName, id: RecordId)
        // case destroyDeletedRecords(table: Database.TableName, records: [RecordId])
        // case setLocal(key: String, value: String)
        // case removeLocal(key: String)
    }

    func batch(_ operations: [Operation]) throws {
        var newIds: [(Database.TableName, RecordId)] = []
        var removedIds: [(Database.TableName, RecordId)] = []

        try database.inTransaction {
            for operation in operations {
                switch operation {
                case .execute(table: let table, query: let query, args: let args):
                    try database.execute(query, args)

                case .create(table: let table, id: let id, query: let query, args: let args):
                    try database.execute(query, args)
                    newIds.append((table, id))

                case .markAsDeleted(table: let table, id: let id):
                    try database.execute("update \(table) set _status='deleted' where id == ?", [id])
                    removedIds.append((table, id))

                case .destroyPermanently(table: let table, id: let id):
                    // TODO: What's the behavior if nothing got deleted?
                    try database.execute("delete from \(table) where id == ?", [id])
                    removedIds.append((table, id))
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

    func getDeletedRecords(table: Database.TableName) throws -> [RecordId] {
        return try database.queryRaw("select id from \(table) where _status='deleted'").map { row in
            row.string(forColumn: "id")!
        }
    }

    func destroyDeletedRecords(table: Database.TableName, records: [RecordId]) throws {
        // TODO: What's the behavior if record doesn't exist or isn't actually deleted?
        let recordIds = records.map { id in "'\(id)'" }.joined(separator: ",")
        try database.execute("delete from \(table) where id in (\(recordIds))")
    }

// MARK: - LocalStorage

    func getLocal(key: String) throws -> String? {
        let results = try database.queryRaw("select value from local_storage where key = ?", [key])

        guard let record = results.next() else {
            return nil
        }

        return record.string(forColumn: "value")!
    }

    func setLocal(key: String, value: String) throws {
        return try database.execute("insert or replace into local_storage (key, value) values (?, ?)", [key, value])
    }

    func removeLocal(key: String) throws {
        return try database.execute("delete from local_storage where key == ?", [key])
    }

// MARK: - Record caching

    typealias RecordId = String

    private var cachedRecords: [Database.TableName: Set<RecordId>] = [:]

    func isCached(_ table: Database.TableName, _ id: RecordId) -> Bool {
        return cachedRecords[table]?.contains(id) ?? false
    }

    private func markAsCached(_ table: Database.TableName, _ id: RecordId) {
        var cachedSet = cachedRecords[table];
        if cachedSet == nil {
            cachedSet = []
        }
        cachedSet!.insert(id)
        cachedRecords[table] = cachedSet
    }
    
    private func removeFromCache(_ table: Database.TableName, _ id: RecordId) {
        cachedRecords[table]?.remove(id)
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
            try database.executeStatements(schema.sql + localStorageSchema)
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

    private let localStorageSchema = """
        create table local_storage (
        key varchar(16) primary key not null,
        value text not null
        );

        create index local_storage_key_index on local_storage (key);
    """
}
