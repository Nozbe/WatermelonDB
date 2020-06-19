import fs from 'fs'
import { testSchema } from '../__tests__/helpers'
import commonTests from '../__tests__/commonTests'

import SqliteAdapter from './index'
import DatabaseAdapterCompat from '../compat'

function removeIfExists(file, dbName) {
  if (file && fs.existsSync(dbName)) {
    fs.unlinkSync(dbName)
  }
}

describe.each([
  ['SQLiteAdapterNode', 'Synchronous', 'File'],
  ['SQLiteAdapterNode', 'Asynchronous', 'File'],
  ['SQLiteAdapterNode', 'Synchronous', 'Memory'],
  ['SQLiteAdapterNode', 'Asynchronous', 'Memory'],
])('%s (%s/%s)', (adapterSubclass, synchronousString, fileString) => {
  commonTests().forEach(testCase => {
    const [name, test] = testCase
    it(name, async () => {
      const synchronous = synchronousString.toLowerCase() === 'synchronous'
      const file = fileString.toLowerCase() === 'file'
      const dbName = `${process.cwd()}/test${Math.random()}.sqlite${
        file ? '' : '?mode=memory&cache=shared'
      }`
      const extraAdapterOptions = {
        dbName,
        synchronous,
        adapterSubclass,
      }
      const adapter = new SqliteAdapter({
        dbName,
        schema: testSchema,
        synchronous,
      })

      try {
        await adapter.initializingPromise
        await test(new DatabaseAdapterCompat(adapter), SqliteAdapter, extraAdapterOptions)
      } finally {
        removeIfExists(file, dbName)
      }
    })
  })
})

// TODO: Run tests with:
// - mocked/polyfilled web worker
// - legacy indexeddb adapter (fake-indexeddb polyfill)
// - modern indexeddb adapter
