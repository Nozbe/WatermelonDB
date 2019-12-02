import Foundation

class Database {
    typealias SQL = String
    typealias TableName = String
    typealias QueryArgs = [Any]

    private let fmdb: FMDatabase
    private let path: String

    init(path: String) {
        self.path = path
        fmdb = FMDatabase(path: path)
        open()
    }

    private func open() {
        guard fmdb.open() else {
            fatalError("Failed to open the database. \(fmdb.lastErrorMessage())")
        }

        // TODO: Experiment with WAL
        // do {
        //     // must be queryRaw - returns value
        //     _ = try queryRaw("pragma journal_mode=wal")
        // } catch {
        //     fatalError("Failed to set database to WAL mode \(error)")
        // }

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

    func unsafeDestroyEverything() throws {
        guard fmdb.close() else {
            throw "Could not close database".asError()
        }

        let manager = FileManager.default
        try manager.removeItem(atPath: path)

        func removeIfExists(_ path: String) throws {
            if manager.fileExists(atPath: path) {
                try manager.removeItem(atPath: path)
            }
        }

        try removeIfExists("\(path)-wal")
        try removeIfExists("\(path)-shm")

        open()
    }
}
