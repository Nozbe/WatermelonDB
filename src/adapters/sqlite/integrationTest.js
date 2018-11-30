import SQLiteAdapter from './index'
import { testSchema } from '../__tests__/helpers'
import commonTests from '../__tests__/commonTests'

const newAdapter = () => new SQLiteAdapter({ schema: testSchema })

const SQLiteAdapterTest = spec => {
  spec.describe('SQLiteAdapter', () => {
    commonTests().forEach(testCase => {
      const [name, test] = testCase
      spec.it(name, async () => {
        const adapter = newAdapter()
        await test(adapter, SQLiteAdapter)
      })
    })
  })
}

export default SQLiteAdapterTest
