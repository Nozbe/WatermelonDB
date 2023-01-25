import expect from '@nozbe/watermelondb_expect'
import { Platform } from 'react-native'
import SQLiteAdapter from './index'
import { testSchema } from '../__tests__/helpers'
import commonTests from '../__tests__/commonTests'
import { invariant } from '../../utils/common'
import DatabaseAdapterCompat from '../compat'

const SQLiteAdapterTest = (spec) => {
  spec.describe('SQLiteAdapter (async mode)', () => {
    spec.it('configures adapter correctly', () => {
      const adapter = new SQLiteAdapter({ schema: testSchema })
      expect(adapter._dispatcherType).toBe('asynchronous')
    })
    commonTests().forEach((testCase) => {
      const [name, test] = testCase
      spec.it(name, async () => {
        const dbName = `file:testdb${Math.random()}?mode=memory&cache=shared`
        const adapter = new SQLiteAdapter({ schema: testSchema, jsi: false, dbName })
        invariant(adapter._dispatcherType === 'asynchronous', 'this should be asynchronous')
        await test(new DatabaseAdapterCompat(adapter), SQLiteAdapter, { dbName }, Platform.OS)
      })
    })
  })
  spec.describe('SQLiteAdapter (JSI mode)', () => {
    commonTests().forEach((testCase) => {
      const [name, test] = testCase
      spec.it(name, async () => {
        // NOTE: This is needed because connectionTag will reset to 0 on bridge reload, but JSI's
        // sqlites will persist in memory
        const dbName = `file:testdb${Math.random()}?mode=memory&cache=shared`
        const adapter = new SQLiteAdapter({ schema: testSchema, jsi: true, dbName })

        invariant(adapter._dispatcherType === 'jsi', 'native platforms should support jsi')

        await test(
          new DatabaseAdapterCompat(adapter),
          SQLiteAdapter,
          { jsi: true, dbName },
          Platform.OS,
        )
      })
    })
  })
}

export default SQLiteAdapterTest
