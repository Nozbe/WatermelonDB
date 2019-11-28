import { testSchema } from '../__tests__/helpers'
import commonTests from '../__tests__/commonTests'

import LokiJSAdapter from './index'

// require('fake-indexeddb/auto')

describe('LokiJSAdapter (Synchronous / Memory persistence)', () => {
  commonTests().forEach(testCase => {
    const [name, test] = testCase

    it(name, async () => {
      const adapter = new LokiJSAdapter({
        dbName: `test${Math.random()}`,
        schema: testSchema,
        useWebWorker: false,
      })
      await test(adapter, LokiJSAdapter)
    })
  })
})

// TODO: Run tests with:
// - mocked/polyfilled web worker
// - legacy indexeddb adapter (fake-indexeddb polyfill)
// - modern indexeddb adapter
