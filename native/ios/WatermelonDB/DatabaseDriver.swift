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
        case .Compatible: break;
        case .NeedsSetup:
            throw SchemaNeededError()
        case .NeedsMigration(fromVersion: let dbVersion):
            throw MigrationNeededError(databaseVersion: dbVersion)
        }
    }

    convenience init(dbName: String, setUpWithSchema schema: Schema) {
        self.init(dbName: dbName)
        setUpDatabase(schema: schema)
    }

    convenience init(dbName: String, setUpWithMigrations migrations: MigrationSet) {
        self.init(dbName: dbName)
        migrate(with: migrations)
    }

    private init(dbName: String) {
        self.database = Database(isTestRunning ? nil : "\(dbName).db")
    }

    func find(table: Database.TableName, id: RecordId) throws -> Any? {
        guard !isCached(id) else {
            return id
        }

        let results = try database.queryRaw("select * from \(table) where id == ? limit 1", [id])

        guard let record = results.next() else {
            return nil
        }

        markAsCached(id)
        return record.resultDictionary!
    }

    func cachedQuery(_ query: Database.SQL) throws -> [Any] {
        return try database.queryRaw(query).map { row in
            let id = row.string(forColumn: "id")!

            if isCached(id) {
                return id
            } else {
                markAsCached(id)
                return row.resultDictionary!
            }
        }
    }

    func count(_ query: Database.SQL) throws -> Int {
        return try database.count(query)
    }

    enum Operation {
        case execute(query: Database.SQL, args: Database.QueryArgs)
        case create(id: RecordId, query: Database.SQL, args: Database.QueryArgs)
        case destroyPermanently(table: Database.TableName, id: RecordId)
        case markAsDeleted(table: Database.TableName, id: RecordId)
        // case destroyDeletedRecords(table: Database.TableName, records: [RecordId])
        // case setLocal(key: String, value: String)
        // case removeLocal(key: String)
    }

    func batch(_ operations: [Operation]) throws {
        var newIds: [RecordId] = []
        var removedIds: [RecordId] = []

        try database.inTransaction {
            for operation in operations {
                switch operation {
                case .execute(let query, args: let args):
                    try database.execute(query, args)

                case .create(id: let id, query: let query, args: let args):
                    try database.execute(query, args)
                    newIds.append(id)

                case .markAsDeleted(table: let table, id: let id):
                    try database.execute("update \(table) set _status='deleted' where id == ?", [id])
                    removedIds.append(id)

                case .destroyPermanently(table: let table, id: let id):
                    // TODO: What's the behavior if nothing got deleted?
                    try database.execute("delete from \(table) where id == ?", [id])
                    removedIds.append(id)
                }
            }
        }

        for id in newIds {
            markAsCached(id)
        }

        for id in removedIds {
            cachedRecords.remove(id)
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

    private var cachedRecords: Set<RecordId> = []

    func isCached(_ id: RecordId) -> Bool {
        return cachedRecords.contains(id)
    }

    private func markAsCached(_ id: RecordId) {
        cachedRecords.insert(id)
    }

    func unsafeClearCachedRecords() {
        if isTestRunning {
            cachedRecords = []
        }
    }

// MARK: - Other private details

    private enum SchemaCompatibility {
        case Compatible
        case NeedsSetup
        case NeedsMigration(fromVersion: SchemaVersion)
    }

    private func isCompatible(withVersion schemaVersion: SchemaVersion) -> SchemaCompatibility {
        let databaseVersion = database.userVersion

        if databaseVersion == schemaVersion {
            return .Compatible
        } else if databaseVersion == 0 {
            return .NeedsSetup
        } else if databaseVersion > 0 && databaseVersion < schemaVersion {
            return .NeedsMigration(fromVersion: databaseVersion)
        } else {
            // TODO: Safe to assume this would only happen in dev and we can safely reset the database?
            consoleLog("Seems like the database has newer version (\(databaseVersion)) than what the app supports (\(schemaVersion)). Will reset database.")
            return .NeedsSetup
        }
    }

    private func setUpDatabase(schema: Schema) {
        consoleLog("Setting up database with version \(schema.version)")

        do {
            try unsafeResetDatabase(schema: schema)
        } catch {
            fatalError("Error while setting up the database: \(error)")
        }
    }

    func unsafeResetDatabase(schema: Schema) throws {
        try database.unsafeDestroyEverything()
        cachedRecords = []

        try setUpSchema(schema: schema)
    }

    private func setUpSchema(schema: Schema) throws {
        consoleLog("Setting up schema")
        try database.executeStatements(schema.sql + localStorageSchema)
        database.userVersion = schema.version
    }

    private func migrate(with migrations: MigrationSet) {
        consoleLog("Migrating database from version \(migrations.from) to \(migrations.to)")
        precondition(database.userVersion == migrations.from, "Incompatbile migration set applied. DB: \(database.userVersion), migration: \(migrations.from)")
        
        do {
            try database.executeStatements(migrations.sql)
            database.userVersion = migrations.to
        } catch {
            // TODO: Should we crash here? Is this recoverable? Is handling in JS better?
            fatalError("Error while performing migrations: \(error)")
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
