import expect from 'expect'
import { Platform } from 'react-native'
import SQLiteAdapter from './index'
import { testSchema } from '../__tests__/helpers'
import commonTests from '../__tests__/commonTests'
import { invariant } from '../../utils/common'
import DatabaseAdapterCompat from '../compat'

const SQLiteAdapterTest = spec => {
  // spec.describe('SQLiteAdapter (async mode)', () => {
  //   spec.it('configures adapter correctly', () => {
  //     const adapter = new SQLiteAdapter({ schema: testSchema })
  //     expect(adapter._dispatcherType).toBe('asynchronous')
  //   })
  //   commonTests().forEach(testCase => {
  //     const [name, test] = testCase
  //     spec.it(name, async () => {
  //       const adapter = new SQLiteAdapter({ schema: testSchema, synchronous: false })
  //       invariant(adapter._dispatcherType === 'asynchronous', 'this should be asynchronous')
  //       await test(new DatabaseAdapterCompat(adapter), SQLiteAdapter, {})
  //     })
  //   })
  // })
  // spec.describe('SQLiteAdapter (synchronous mode)', () => {
  //   commonTests().forEach(testCase => {
  //     const [name, test] = testCase
  //     spec.it(name, async () => {
  //       const adapter = new SQLiteAdapter({ schema: testSchema, synchronous: true })

  //       if (Platform.OS === 'ios') {
  //         invariant(adapter._dispatcherType === 'synchronous', 'this should be synchronous')
  //       } else {
  //         invariant(
  //           adapter._dispatcherType === 'asynchronous',
  //           'this should be asynchronous - android does not support synchronous adapter',
  //         )
  //       }

  //       // TODO: Remove me. Temporary workaround for the race condition - wait until next macrotask to ensure that database has set up
  //       await new Promise(resolve => setTimeout(resolve, 0))
  //       await test(new DatabaseAdapterCompat(adapter), SQLiteAdapter, { synchronous: true })
  //     })
  //   })
  // })
  spec.describe('SQLiteAdapter (JSI mode)', () => {
    commonTests().forEach(testCase => {
      const [name, test, x] = testCase
      x &&
        spec.it(name, async () => {
          const adapter = new SQLiteAdapter({ schema: testSchema, experimentalUseJSI: true })

          invariant(adapter._dispatcherType === 'jsi', 'native platforms should support jsi')

          // TODO: Remove me. Temporary workaround for the race condition - wait until next macrotask to ensure that database has set up
          await new Promise(resolve => setTimeout(resolve, 0))
          await test(new DatabaseAdapterCompat(adapter), SQLiteAdapter, {
            experimentalUseJSI: true,
          })
        })
    })
  })
}

export default SQLiteAdapterTest
