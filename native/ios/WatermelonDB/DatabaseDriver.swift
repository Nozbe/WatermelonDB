import Foundation

class DatabaseDriver {
    struct Configuration {
        let dbName: String
        let schema: Database.SQL
        let schemaVersion: Int
    }

    let configuration: Configuration
    private(set) lazy var database = Database(isTestRunning ? nil : "\(self.configuration.dbName).db")

    init(configuration: Configuration) {
        self.configuration = configuration
        setUp()
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

    private func setUp() {
        // If database is outdated, build a clean one
        // TODO: Perform actual migrations
        do {
            if database.userVersion != configuration.schemaVersion {
                try unsafeResetDatabase()
            }
        } catch {
            fatalError("Error while setting up the database: \(error)")
        }
    }

    func unsafeResetDatabase() throws {
        try database.unsafeDestroyEverything()
        cachedRecords = []

        try setUpSchema()
    }

    private func setUpSchema() throws {
        consoleLog("Setting up schema")
        try database.executeStatements(configuration.schema + localStorageSchema)
        database.userVersion = configuration.schemaVersion
    }

    private let localStorageSchema = """
        create table local_storage (
        key varchar(16) primary key not null,
        value text not null
        );

        create index local_storage_key_index on local_storage (key);
    """
}
