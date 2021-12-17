import { testSchema } from '../__tests__/helpers'
import commonTests from '../__tests__/commonTests'

import LokiJSAdapter from './index'
import DatabaseAdapterCompat from '../compat'

// require('fake-indexeddb/auto')

describe('LokiJSAdapter (Synchronous / Memory persistence)', () => {
  commonTests().forEach((testCase) => {
    const [name, test] = testCase

    it(name, async () => {
      const dbName = `test${Math.random()}`
      const adapter = new LokiJSAdapter({
        dbName,
        schema: testSchema,
        useWebWorker: false,
        useIncrementalIndexedDB: false,
      })
      await test(new DatabaseAdapterCompat(adapter), LokiJSAdapter, {
        useWebWorker: false,
        useIncrementalIndexedDB: false,
        dbName,
      })
    })
  })
})

// TODO: Run tests with:
// - mocked/polyfilled web worker
// - legacy indexeddb adapter (fake-indexeddb polyfill)
// - modern indexeddb adapter
