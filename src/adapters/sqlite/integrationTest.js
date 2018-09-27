import SQLiteAdapter from 'adapters/sqlite'
import { testSchema } from 'adapters/__tests__/helpers'
import commonTests from 'adapters/__tests__/commonTests'

const newAdapter = () => new SQLiteAdapter({ dbName: 'test', schema: testSchema })

const SQLiteAdapterTest = spec => {
  spec.describe('watermelondb/adapters/sqlite', () => {
    commonTests().forEach(testCase => {
      const [name, test] = testCase
      const adapter = newAdapter()
      spec.it(name, test(adapter, SQLiteAdapter))
    })
  })
}

export default SQLiteAdapterTest
