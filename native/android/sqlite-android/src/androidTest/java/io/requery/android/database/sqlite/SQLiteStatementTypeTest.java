package io.requery.android.database.sqlite;

import static io.requery.android.database.sqlite.SQLiteStatementTypeTest.TestData.test;

import org.junit.Assert;
import org.junit.Test;

public class SQLiteStatementTypeTest {

    @Test
    public void recognizesSelectQueryWithComments() {
        String query = "--comment --comment\nSELECT * FROM table WHERE id = 1";
        Assert.assertEquals(SQLiteStatementType.STATEMENT_SELECT, SQLiteStatementType.getSqlStatementType(query));
    }

    @Test
    public void recognizesUntrimmedSelectQueryWithoutComments() {
        String query = " \n SELECT * FROM table WHERE id = 1";
        Assert.assertEquals(SQLiteStatementType.STATEMENT_SELECT, SQLiteStatementType.getSqlStatementType(query));
    }

    @Test
    public void recognizesTrimmedSelectQueryWithoutComments() {
        String query = "SELECT * FROM table WHERE id = 1";
        Assert.assertEquals(SQLiteStatementType.STATEMENT_SELECT, SQLiteStatementType.getSqlStatementType(query));
    }

    @Test
    public void recognizesUpdateQueryWithComments() {
        String query = "--comment\nINSERT INTO phones (num) VALUES ('911');";
        Assert.assertEquals(SQLiteStatementType.STATEMENT_UPDATE, SQLiteStatementType.getSqlStatementType(query));
    }

    @Test
    public void notCrashingOnInvalidQuery() {
        // Checking for index out of bounds, because `getSqlStatementType` uses (statementStartIndex + 3) as its end index
        String query = "--comment\nSE";
        Assert.assertEquals(SQLiteStatementType.STATEMENT_OTHER, SQLiteStatementType.getSqlStatementType(query));
    }

    @Test
    public void testStripSqlComments() {
        for (TestData test : queriesTestData) {
            int start = SQLiteStatementType.statementStartIndex(test.inputQuery);
            String strippedSql = test.inputQuery.substring(start);
            Assert.assertEquals("Error in test case\n" + test.inputQuery, test.expectedQuery, strippedSql);
        }
    }

    private static final TestData[] queriesTestData = {
            test("", ""),
            test(" ", " "),
            test("\n", "\n"),
            test(
                    "\n-- ?1 - version id, required\n-- ?2 - account id, optional\nSELECT\n  SUM(col1 + col2) AS count\nFROM\n  Accounts\nWHERE\n  id = ?1\nAND\n  col3 = 0\nAND\n  CASE WHEN COALESCE(?2, '') = '' THEN 1 ELSE entityId = ?2 END\n",
                    "SELECT\n  SUM(col1 + col2) AS count\nFROM\n  Accounts\nWHERE\n  id = ?1\nAND\n  col3 = 0\nAND\n  CASE WHEN COALESCE(?2, '') = '' THEN 1 ELSE entityId = ?2 END\n"
            ),
            test(
                    "select * from employees",
                    "select * from employees"
            ),
            test(
                    "select * from employees -- this is a comment",
                    "select * from employees -- this is a comment"
            ),
            test(
                    "select * from employees /* first comment */-- second comment",
                    "select * from employees /* first comment */-- second comment"
            ),
            test(
                    "-- this is a comment\nselect * from employees",
                    "select * from employees"
            ),
            test(
                    "-- this is a comment\nselect \"--col\" from employees",
                    "select \"--col\" from employees"
            ),
            test(
                    "-------this is a comment\nselect * from employees",
                    "select * from employees"
            ),
            test(
                    "\n-- ?1 first parameter id\n-- ?2 second parameter format \"yyyy-mm-01\"\n-- ?3 third parameter either 'value1' or 'value2'\n\nselect * from employees where param1 = ?1 AND param2 = ?2 AND param3 = ?3",
                    "select * from employees where param1 = ?1 AND param2 = ?2 AND param3 = ?3"
            ),
            test(
                    "/* Single Line Block Comment */ select * from employees",
                    "select * from employees"
            ),
            test(
                    "/* Single Line Block Comment */\nselect * from employees",
                    "select * from employees"
            ),
            test(
                    "/* Multiline Line Block Comment\nHere is another line\nAnd another */\nselect * from employees",
                    "select * from employees"
            ),
            test(
                    "/*Multiline Line Block Comment\nHere is another line\nAnd another */\nselect * from employees",
                    "select * from employees"
            ),
            test(
                    "\nselect * from employees where /* this is param 1 */ param1 = ?1 AND /* this is param 2 */ param2 = ?2 AND /* this is param 3 */ param3 = ?3",
                    "select * from employees where /* this is param 1 */ param1 = ?1 AND /* this is param 2 */ param2 = ?2 AND /* this is param 3 */ param3 = ?3"
            ),
            test(
                    "/* Single Line Block Comment */\n-- another comment\nselect * from employees",
                    "select * from employees"
            ),
            test(
                    "/* Single Line Block Comment */\n--another comment\nselect * from employees",
                    "select * from employees"
            ),
            test(
                    "/* Multiline Line Block Comment\nLine 2\nLine 3 */\n-- dashed comment\nselect * from employees",
                    "select * from employees"
            ),
            test(
                    "/* Multiline Line Block Comment\nLine 2\n-- dashed comment inside block comment\nLine 3 */\nselect * from employees",
                    "select * from employees"
            ),
            test(
                    "\nSELECT\n  'All Accounts' AS name,\n  'all-accounts' AS internal_name\nFROM\n  Accounts\nWHERE\n  id = ?1\nAND\n  col3 = 0\n    ",
                    "SELECT\n  'All Accounts' AS name,\n  'all-accounts' AS internal_name\nFROM\n  Accounts\nWHERE\n  id = ?1\nAND\n  col3 = 0\n    "
            ),
            test(
                    "/* Multiline Line Block Comment\nLine 2\nLine 3 */-- single line comment\nselect * from employees",
                    "select * from employees"
            ),
            test(
                    "/* Multiline Line Block Comment\nhttps://foo.bar.com/document/d/283472938749/foo.ts\nLine 3 */-- single line comment\nSELECT\n  'All Accounts' AS name,\n  'all-accounts' AS internal_name\nFROM\n  Accounts\nWHERE\n  id = ?1\nAND\n  col3 = 0\n    ",
                    "SELECT\n  'All Accounts' AS name,\n  'all-accounts' AS internal_name\nFROM\n  Accounts\nWHERE\n  id = ?1\nAND\n  col3 = 0\n    "
            ),
            // Shouldn't crash on invalid query
            test(
                    "/* Single Line Block Comment */SE",
                    "SE"
            ),
    };

    static class TestData {
        final String inputQuery;
        final String expectedQuery;

        TestData(String inputQuery, String expectedQuery) {
            this.inputQuery = inputQuery;
            this.expectedQuery = expectedQuery;
        }

        static TestData test(String inputQuery, String expectedQuery) {
            return new TestData(inputQuery, expectedQuery);
        }
    }
}
