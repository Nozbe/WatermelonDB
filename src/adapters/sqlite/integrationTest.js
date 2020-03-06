import expect from 'expect'
import { Platform } from 'react-native'
import SQLiteAdapter from './index'
import { testSchema } from '../__tests__/helpers'
import commonTests from '../__tests__/commonTests'
import { invariant } from '../../utils/common'
import DatabaseAdapterCompat from '../compat'

const SQLiteAdapterTest = spec => {
  const runTests = isSynchronous => {
    commonTests().forEach(testCase => {
      const [name, test] = testCase
      spec.it(name, async () => {
        const adapter = new SQLiteAdapter({ schema: testSchema, synchronous: isSynchronous })

        if (isSynchronous) {
          if (Platform.OS === 'ios') {
            invariant(adapter._synchronous === true, 'this should be synchronous')
          } else {
            invariant(
              adapter._synchronous === false,
              'this should be asynchronous - android does not support synchronous adaoter',
            )
          }

          // Temporary workaround for the race condition - wait until next macrotask to ensure that
          // database has set up
          await new Promise(resolve => setTimeout(resolve, 0))
        } else {
          invariant(adapter._synchronous === false, 'this should be asynchronous')
        }
        await test(new DatabaseAdapterCompat(adapter), SQLiteAdapter)
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
