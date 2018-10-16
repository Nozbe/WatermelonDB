// swiftlint:disable force_try
@testable import WatermelonDB
import XCTest
import Nimble

private let insertTestQuery = "insert into test (id, created_at, name, _status) values (?, ?, ?, 'created')"
private let testRecord1Args = ["1", 1, "name1"] as Database.QueryArgs
private let testRecord2Args = ["2", 2, "name2"] as Database.QueryArgs
private let testRecord3Args = ["3", 3, "name3"] as Database.QueryArgs
private let testRecord4Args = ["4", 4, "name4"] as Database.QueryArgs

private let selectAllQuery = "select * from test where _status is not 'deleted'"
private let countAllQuery = "select count(*) as count from test where _status is not 'deleted'"

private func ns(_ array: [Any]) -> NSArray {
    return array as NSArray
}

let testSchema = """
    create table test (
        id varchar(16) primary key not null,
        created_at datetime not null,
        name varchar(255) not null,
        _status varchar(16)
    );
    """

func newDatabase() -> DatabaseDriver {
    return DatabaseDriver(dbName: ":memory:", setUpWithSchema: (version: 1, sql: testSchema))
}

class DatabaseDriverTests: XCTestCase {
    func testSetUp() {
        let db = newDatabase()
        expect(try! db.database.count("select count(*) as count from sqlite_master")) > 0
    }

    func testExecuteBatch() {
        let db = newDatabase()

        try! db.batch([.execute(query: insertTestQuery, args: testRecord1Args)])
        try! db.batch([.create(id: "2", query: insertTestQuery, args: testRecord2Args)])

        try! db.batch([
            .create(id: "3", query: insertTestQuery, args: testRecord3Args),
            .markAsDeleted(table: "test", id: "2"),
            .create(id: "4", query: insertTestQuery, args: testRecord4Args),
            .markAsDeleted(table: "test", id: "4"),
            .execute(query: "update test set name=? where id=?", args: ["new_name", "1"]),
        ])

        expect(try! ns(db.cachedQuery("select * from test where id='1'"))) == ns([
            ["id": "1", "created_at": 1, "name": "new_name", "_status": "created"],
            ])

        // Check if caching is correct
        expect(try! ns(db.cachedQuery(selectAllQuery))) == ns(["1", "3"])
        expect(try! db.getDeletedRecords(table: "test")) == ["2", "4"]
        expect(db.isCached("2")) == false
        expect(db.isCached("4")) == false
    }

    func testExecuteBatchTransactionality() {
        let db = newDatabase()

        try! db.batch([.create(id: "1", query: insertTestQuery, args: testRecord1Args)])

        expect {
            try db.batch([
                .markAsDeleted(table: "test", id: "1"),
                .create(id: "2", query: insertTestQuery, args: testRecord2Args),
                .execute(query: "bad query", args: []),
                .create(id: "4", query: insertTestQuery, args: testRecord4Args),
                .create(id: "zzz", query: "bad query 2", args: []),
            ])
        }.to(throwError())

        expect(try! ns(db.cachedQuery(selectAllQuery))) == ns(["1"])
        expect(try! db.getDeletedRecords(table: "test")) == []
        expect(db.isCached("1")) == true
        expect(db.isCached("2")) == false
    }

    func testBadQueries() {
        let db = newDatabase()

        expect { try db.batch([.execute(query:"blah blah", args: [])]) }.to(throwError())
        expect { try db.cachedQuery("blah blah") }.to(throwError())
        expect { try db.count("blah blah") }.to(throwError())

        expect { try db.batch([.execute(query: "insert into bad_table (a) values (1)", args: [])]) }.to(throwError())

        expect { try db.count(selectAllQuery) }.to(throwError())
        expect { try db.count("select count(*) from test") }.to(throwError()) // missing `as count`
    }
}
