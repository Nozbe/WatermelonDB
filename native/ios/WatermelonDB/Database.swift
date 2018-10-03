import Foundation

class Database {
    typealias SQL = String
    typealias TableName = String
    typealias QueryArgs = [Any]

    private let fmdb: FMDatabase

    init(_ name: String?) {
        if let name = name {
            // Path to the database
            // swiftlint:disable:next force_try
            let url = try! FileManager.default
                .url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: false)
                .appendingPathComponent(name)

            consoleLog("Database is at: \(url.path)")

            // Open a connection
            fmdb = FMDatabase(path: url.path)
        } else {
            // Open in-memory database (for testing)
            fmdb = FMDatabase(path: nil)
        }

        guard fmdb.open() else {
            fatalError("Failed to open the database. \(fmdb.lastErrorMessage())")
        }
    }

    init(db: FMDatabase) {
        fmdb = db
        guard fmdb.open() else {
            fatalError("Failed to open the database. \(fmdb.lastErrorMessage())")
        }
    }

    func inTransaction(_ executeBlock: () throws -> Void) throws {
        guard fmdb.beginTransaction() else { throw fmdb.lastError() }

        do {
            try executeBlock()
            guard fmdb.commit() else { throw fmdb.lastError() }
        } catch {
            guard fmdb.rollback() else { throw fmdb.lastError() }
            throw error
        }
    }

    func execute(_ query: SQL, _ args: QueryArgs = []) throws {
        try fmdb.executeUpdate(query, values: args)
    }

    /// Executes multiple queries separated by `;`
    func executeStatements(_ queries: SQL) throws {
        guard fmdb.executeStatements(queries) else {
            throw fmdb.lastError()
        }
    }

    func queryRaw(_ query: SQL, _ args: QueryArgs = []) throws -> AnyIterator<FMResultSet> {
        let resultSet = try fmdb.executeQuery(query, values: args)

        return AnyIterator {
            if resultSet.next() {
                return resultSet
            } else {
                resultSet.close()
                return nil
            }
        }
    }

    /// Use `select count(*) as count`
    func count(_ query: SQL, _ args: QueryArgs = []) throws -> Int {
        let result = try fmdb.executeQuery(query, values: args)

        guard result.next() else {
            throw "Invalid count query, can't find next() on the result".asError()
        }

        guard result.columnIndex(forName: "count") != -1 else {
            throw "Invalid count query, can't find `count` column".asError()
        }

        return Int(result.int(forColumn: "count"))
    }

    var userVersion: Int {
        get {
            // swiftlint:disable:next force_try
            let result = try! fmdb.executeQuery("pragma user_version", values: [])
            result.next()
            defer { result.close() }
            return result.long(forColumnIndex: 0)
        }
        set {
            // swiftlint:disable:next force_try
            try! execute("pragma user_version = \(newValue)")
        }
    }

    /// Drops all tables, indexes, and resets user version to 0
    func unsafeDestroyEverything() throws {
        // TODO: Shouldn't this simply destroy the database file?
        consoleLog("Clearing database")

        fmdb.beginTransaction()

        let tables = try queryRaw("select * from sqlite_master where type='table'").map { table in
            table.string(forColumn: "name")!
        }

        for table in tables {
            try execute("drop table if exists \(table)")
        }

        try execute("pragma writable_schema=1")
        try execute("delete from sqlite_master")
        try execute("pragma user_version=0")
        try execute("pragma writable_schema=0")

        fmdb.commit()
    }
}
