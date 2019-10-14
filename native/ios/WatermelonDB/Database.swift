import Foundation

class Database {
    typealias SQL = String
    typealias TableName = String
    typealias QueryArgs = [Any]

    private let fmdb: FMDatabase

    init(path: String) {
        fmdb = FMDatabase(path: path)

        guard fmdb.open() else {
            fatalError("Failed to open the database. \(fmdb.lastErrorMessage())")
        }

        do {
            // must be queryRaw - returns value
            _ = try queryRaw("pragma journal_mode=wal")
        } catch {
            fatalError("Failed to set database to WAL mode \(error)")
        }

        consoleLog("Opened database at: \(path)")
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
        // TODO: Shouldn't this simply destroy the database file? - if so remember about wal/shl files too
        consoleLog("Clearing database")

        try inTransaction {
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
        }
    }
}
