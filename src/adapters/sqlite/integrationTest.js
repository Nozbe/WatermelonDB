import expect from 'expect'
import SQLiteAdapter from './index'
import { testSchema } from '../__tests__/helpers'
import commonTests from '../__tests__/commonTests'

const SQLiteAdapterTest = spec => {
  const runTests = isSynchronous => {
    commonTests().forEach(testCase => {
      const [name, test] = testCase
      spec.it(name, async () => {
        const adapter = new SQLiteAdapter({ schema: testSchema, synchronous: isSynchronous })
        if (adapter._synchronous !== isSynchronous) {
          throw new Error('test setup bug')
        }
        if (isSynchronous) {
          await new Promise(resolve => setTimeout(resolve, 0))
        }
        await test(adapter, SQLiteAdapter)
      })
    })
  }

  spec.describe('SQLiteAdapter (asynchronous mode)', () => {
    spec.it('configures adapter correctly', () => {
      const adapter = new SQLiteAdapter({ schema: testSchema })
      expect(adapter._synchronous).toBe(false)
    })
    runTests(false)
  })
  spec.describe('SQLiteAdapter (synchronous mode)', () => {
    runTests(true)
  })
}

export default SQLiteAdapterTest
