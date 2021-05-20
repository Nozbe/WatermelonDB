// swiftlint:disable force_try
@testable import WatermelonDB
import XCTest
import Nimble

private let testTable = "test"
private let insertTestQuery = "insert into \(testTable) (id, created_at, name, _status) values (?, ?, ?, 'created')"
private let testRecord1Args = ["1", 1, "name1"] as Database.QueryArgs
private let testRecord2Args = ["2", 2, "name2"] as Database.QueryArgs
private let testRecord3Args = ["3", 3, "name3"] as Database.QueryArgs
private let testRecord4Args = ["4", 4, "name4"] as Database.QueryArgs

private let selectAllQuery = "select * from \(testTable) where _status is not 'deleted'"
private let countAllQuery = "select count(*) as count from \(testTable) where _status is not 'deleted'"

private func ns(_ array: [Any]) -> NSArray {
    return array as NSArray
}

let testSchema = """
    create table \(testTable) (
        id varchar(16) primary key not null,
        created_at datetime not null,
        name varchar(255) not null,
        _status varchar(16)
    );
    """

func newDatabase() -> DatabaseDriver {
    return DatabaseDriver(dbName: ":memory:", setUpWithSchema: (version: 1, sql: testSchema))
}

func throwsError(_ fn: () throws -> Void) -> Bool {
    do {
        try fn()
        return false
    } catch {
        return true
    }
}

class DatabaseDriverTests: XCTestCase {
    func testSetUp() {
        let db = newDatabase()
        expect(try! db.database.count("select count(*) as count from sqlite_master")) > 0
    }

    func testExecuteBatch() {
        let db = newDatabase()

        try! db.batch([.execute(query: insertTestQuery, args: testRecord1Args)])
        try! db.batch([.create(table: testTable, id: "2", query: insertTestQuery, args: testRecord2Args)])

        try! db.batch([
            .create(table: testTable, id: "3", query: insertTestQuery, args: testRecord3Args),
            .markAsDeleted(table: testTable, id: "2"),
            .create(table: testTable, id: "4", query: insertTestQuery, args: testRecord4Args),
            .markAsDeleted(table: testTable, id: "4"),
            .execute(query: "update \(testTable) set name=? where id=?", args: ["new_name", "1"]),
        ])

        expect(try! ns(db.cachedQuery(table: testTable, query: "select * from \(testTable) where id='1'"))) == ns([
            ["id": "1", "created_at": 1, "name": "new_name", "_status": "created"],
            ])

        // Check if caching is correct
        expect(try! ns(db.cachedQuery(table: testTable, query: selectAllQuery))) == ns(["1", "3"])
        expect(db.isCached(testTable, "2")) == false
        expect(db.isCached(testTable, "4")) == false
    }

    func testExecuteBatchTransactionality() {
        let db = newDatabase()

        try! db.batch([.create(table: testTable, id: "1", query: insertTestQuery, args: testRecord1Args)])

        expect(throwsError { try db.batch([
            .markAsDeleted(table: testTable, id: "1"),
            .create(table: testTable, id: "2", query: insertTestQuery, args: testRecord2Args),
            .execute(query: "bad query", args: []),
            .create(table: testTable, id: "4", query: insertTestQuery, args: testRecord4Args),
            .create(table: testTable, id: "zzz", query: "bad query 2", args: []),
        ]) }) == true

        expect(try! ns(db.cachedQuery(table: testTable, query: selectAllQuery))) == ns(["1"])
        expect(db.isCached(testTable, "1")) == true
        expect(db.isCached(testTable, "2")) == false
    }

    func testBadQueries() {
        let db = newDatabase()

        expect(throwsError { try db.batch([.execute(query:"blah blah", args: [])]) }) == true
        expect(throwsError { _ = try db.cachedQuery(table: testTable, query: "blah blah") }) == true
        expect(throwsError { _ = try db.count(testTable) }) == true

        expect(throwsError { try db.batch([.execute(query: "insert into bad_table (a) values (1)", args: [])]) }
            ) == true

        expect(throwsError { _ = try db.count(selectAllQuery) }) == true
        expect(throwsError { _ = try db.count("select count(*) from \(testTable)") }) == true // missing `as count`
    }
}
