import { testSchema } from '../__tests__/helpers'
import commonTests from '../__tests__/commonTests'

import LokiJSAdapter from './index'
import DatabaseAdapterCompat from '../compat'

// require('fake-indexeddb/auto')

describe('LokiJSAdapter (Synchronous / Memory persistence)', () => {
  commonTests().forEach((testCase) => {
    const [name, test] = testCase

    // eslint-disable-next-line jest/valid-title
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

// Mimics IncrementalIndexedDBAdapter, which throws if asked to do something while an operation is
// in progress. While `holdSaves` is set, saves stay in progress until `finishSave()` is called
class SlowIncrementalAdapter {
  mode = 'incremental'

  operationInProgress = false

  holdSaves = false

  finishSave = null

  deleteCount = 0

  loadDatabase(dbname, callback) {
    callback(null)
  }

  saveDatabase(dbname, getLokiCopy, callback) {
    if (this.operationInProgress) {
      throw new Error('Error while saving to database - another operation is already in progress')
    }
    this.operationInProgress = true
    getLokiCopy()
    const finish = () => {
      this.operationInProgress = false
      callback()
    }
    if (this.holdSaves) {
      this.finishSave = finish
    } else {
      setTimeout(finish, 1)
    }
  }

  deleteDatabase(dbname, callback) {
    if (this.operationInProgress) {
      throw new Error('Error while deleting database - another operation is already in progress')
    }
    this.deleteCount += 1
    callback({ success: true })
  }
}

describe('LokiJSAdapter (Incremental persistence)', () => {
  it('waits for a save in progress before resetting database', async () => {
    const persistenceAdapter = new SlowIncrementalAdapter()
    const adapter = new DatabaseAdapterCompat(
      new LokiJSAdapter({
        dbName: `test${Math.random()}`,
        schema: testSchema,
        useWebWorker: false,
        useIncrementalIndexedDB: true,
        _testLokiAdapter: persistenceAdapter,
      }),
    )
    await adapter.setLocal('foo', 'bar')
    const deleteCount = persistenceAdapter.deleteCount

    // start a save, which clears Loki's dirty flags while it's still in progress
    persistenceAdapter.holdSaves = true
    await adapter.unsafeExecute({ loki: (loki) => loki.saveDatabase() })
    persistenceAdapter.holdSaves = false
    expect(persistenceAdapter.operationInProgress).toBe(true)

    const reset = adapter.unsafeResetDatabase()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(persistenceAdapter.deleteCount).toBe(deleteCount)

    persistenceAdapter.finishSave()
    await reset
    expect(persistenceAdapter.deleteCount).toBe(deleteCount + 1)
    expect(await adapter.getLocal('foo')).toBe(null)
  })
})

// TODO: Run tests with:
// - mocked/polyfilled web worker
// - legacy indexeddb adapter (fake-indexeddb polyfill)
// - modern indexeddb adapter
