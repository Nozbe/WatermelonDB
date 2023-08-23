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
  // ['SQLiteAdapterNode', 'Asynchronous', 'File'],
  ['SQLiteAdapterNode', 'Asynchronous', 'Memory'],
])('%s (%s/%s)', (adapterSubclass, fileString) => {
  commonTests().forEach((testCase) => {
    const [name, test] = testCase

    if (name.match(/from file system/) && process.platform === 'win32') {
      // eslint-disable-next-line no-console
      console.error(`FIXME: Broken test on Windows! ${name}`)
      return
    }

    // eslint-disable-next-line jest/valid-title
    it(name, async () => {
      const file = fileString.toLowerCase() === 'file'

      // NOTE: one test uses .tmp/xx path, but we have to create it first
      if (!fs.existsSync('.tmp')) {
        fs.mkdirSync('.tmp')
      }

      const dbName = `${process.cwd()}/test${Math.random()}.db${
        file ? '' : '?mode=memory&cache=shared'
      }`
      const extraAdapterOptions = {
        dbName,
        adapterSubclass,
      }
      const adapter = new SqliteAdapter({
        dbName,
        schema: testSchema,
      })

      try {
        await adapter.initializingPromise
        await test(new DatabaseAdapterCompat(adapter), SqliteAdapter, extraAdapterOptions, 'node')
      } finally {
        removeIfExists(file, dbName)
      }
    })
  })
})
