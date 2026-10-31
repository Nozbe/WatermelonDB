import { testSchema, mockTaskRaw } from '../__tests__/helpers'

import LokiJSAdapter from './index'
import DatabaseAdapterCompat from '../compat'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const waitFor = async (predicate) => {
  for (let i = 0; i < 200; i += 1) {
    if (predicate()) {
      return
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(5)
  }
  throw new Error('Timed out waiting for condition')
}

// Mimics lokijs's IncrementalIndexedDBAdapter: incremental mode, `options` object, async save callback
class FakeIncrementalAdapter {
  mode = 'incremental'

  options = {}

  saveError = null

  saves = 0

  deletes = 0

  loadDatabase(dbname, callback) {
    callback(null)
  }

  saveDatabase(dbname, getLokiCopy, callback) {
    getLokiCopy()
    this.saves += 1
    const error = this.saveError
    setTimeout(() => callback(error), 0)
  }

  deleteDatabase(dbname, callback) {
    this.deletes += 1
    callback({ success: true })
  }
}

// What IncrementalIndexedDBAdapter passes to the save callback when an IDB transaction aborts
const abortEvent = (error) => ({ type: 'abort', target: { error } })

const quotaError = () => {
  const error = new Error('The quota has been exceeded.')
  error.name = 'QuotaExceededError'
  return error
}

let adapters = []

const makeAdapter = (options) => {
  const adapter = new LokiJSAdapter({
    dbName: `test${Math.random()}`,
    schema: testSchema,
    useWebWorker: false,
    useIncrementalIndexedDB: true,
    extraLokiOptions: { autosaveInterval: 5 },
    ...options,
  })
  adapters.push(adapter)
  return adapter
}

let taskId = 0
const writeTask = (adapter) => {
  taskId += 1
  return adapter.batch([['create', 'tasks', mockTaskRaw({ id: `t${taskId}` })]])
}

afterEach(() => {
  adapters.forEach((adapter) => {
    const loki = adapter._driver?.loki
    loki && loki.autosaveDisable()
  })
  adapters = []
  delete global.indexedDB
})

describe('LokiJSAdapter persistence errors', () => {
  it('reports a failing save once, and again after a successful save in between', async () => {
    const persistenceAdapter = new FakeIncrementalAdapter()
    const onPersistenceError = jest.fn()
    const onQuotaExceededError = jest.fn()
    const adapter = new DatabaseAdapterCompat(
      makeAdapter({
        _testLokiAdapter: persistenceAdapter,
        onPersistenceError,
        onQuotaExceededError,
      }),
    )

    // saves fine
    await writeTask(adapter)
    await waitFor(() => persistenceAdapter.saves >= 1)
    expect(onPersistenceError).not.toHaveBeenCalled()

    // quota exceeded, reported once even though autosave keeps retrying
    const error = quotaError()
    persistenceAdapter.saveError = abortEvent(error)
    await writeTask(adapter)
    await waitFor(() => onPersistenceError.mock.calls.length === 1)
    const savesAfterFailure = persistenceAdapter.saves
    await waitFor(() => persistenceAdapter.saves >= savesAfterFailure + 3)
    expect(onPersistenceError).toHaveBeenCalledTimes(1)
    // raw IDB event is unwrapped
    expect(onPersistenceError).toHaveBeenCalledWith(error)
    expect(onQuotaExceededError).toHaveBeenCalledTimes(1)
    expect(onQuotaExceededError).toHaveBeenCalledWith(error)

    // recovers - the retried save succeeds
    persistenceAdapter.saveError = null
    const savesBeforeRecovery = persistenceAdapter.saves
    await waitFor(() => persistenceAdapter.saves > savesBeforeRecovery)
    await sleep(20)

    // fails again - reported again
    const otherError = new Error('Error saving database')
    persistenceAdapter.saveError = otherError
    await writeTask(adapter)
    await waitFor(() => onPersistenceError.mock.calls.length === 2)
    expect(onPersistenceError).toHaveBeenLastCalledWith(otherError)
    expect(onQuotaExceededError).toHaveBeenCalledTimes(1)
  })

  it('stops saving and breaks the driver when IndexedDB is deleted by another connection', async () => {
    const persistenceAdapter = new FakeIncrementalAdapter()
    const onPersistenceError = jest.fn()
    const onversionchange = jest.fn()
    const _onFatalError = jest.fn()
    const lokiAdapter = makeAdapter({
      _testLokiAdapter: persistenceAdapter,
      onPersistenceError,
      _onFatalError,
      extraIncrementalIDBOptions: { onversionchange },
    })
    const adapter = new DatabaseAdapterCompat(lokiAdapter)

    await writeTask(adapter)
    await waitFor(() => persistenceAdapter.saves >= 1)

    const event = { type: 'versionchange' }
    persistenceAdapter.options.onversionchange(event)

    expect(onversionchange).toHaveBeenCalledWith(event)
    expect(onPersistenceError).toHaveBeenCalledTimes(1)
    expect(onPersistenceError.mock.calls[0][0].name).toBe('VersionChangeError')
    expect(_onFatalError).toHaveBeenCalledTimes(1)

    // changes are rejected, and nothing is saved anymore
    const savesBefore = persistenceAdapter.saves
    await expect(writeTask(adapter)).rejects.toThrow('broken state')
    const rawWrite = jest.fn()
    await expect(adapter.unsafeExecute({ loki: rawWrite })).rejects.toThrow('broken state')
    expect(rawWrite).not.toHaveBeenCalled()
    expect(() => lokiAdapter._driver.loki.saveDatabase()).toThrow()
    await sleep(30)
    expect(persistenceAdapter.saves).toBe(savesBefore)
    expect(onPersistenceError).toHaveBeenCalledTimes(1)

    // reads still work
    expect(await adapter.find('tasks', `t${taskId - 1}`)).toBeTruthy()

    // database can't be deleted and re-created
    const deletesBefore = persistenceAdapter.deletes
    await expect(adapter.unsafeResetDatabase()).rejects.toThrow('broken state')
    expect(persistenceAdapter.deletes).toBe(deletesBefore)
  })

  it('breaks the driver before notifying, and notifies even if callbacks throw', async () => {
    const persistenceAdapter = new FakeIncrementalAdapter()
    const onversionchange = jest.fn()
    let wasBrokenWhenNotified = false
    const lokiAdapter = makeAdapter({
      _testLokiAdapter: persistenceAdapter,
      _onFatalError: () => {
        throw new Error('fatal error handler failed')
      },
      onPersistenceError: () => {
        wasBrokenWhenNotified = lokiAdapter._driver._isBroken
        throw new Error('handler failed')
      },
      extraIncrementalIDBOptions: { onversionchange },
    })
    const adapter = new DatabaseAdapterCompat(lokiAdapter)
    await writeTask(adapter)

    persistenceAdapter.options.onversionchange({ type: 'versionchange' })
    expect(wasBrokenWhenNotified).toBe(true)
    expect(onversionchange).toHaveBeenCalledTimes(1)
    await expect(writeTask(adapter)).rejects.toThrow('broken state')
  })

  it('reports a failing save to onPersistenceError even if onQuotaExceededError throws', async () => {
    const persistenceAdapter = new FakeIncrementalAdapter()
    const onPersistenceError = jest.fn()
    const adapter = new DatabaseAdapterCompat(
      makeAdapter({
        _testLokiAdapter: persistenceAdapter,
        onPersistenceError,
        onQuotaExceededError: () => {
          throw new Error('quota handler failed')
        },
      }),
    )
    const error = quotaError()
    persistenceAdapter.saveError = abortEvent(error)
    await writeTask(adapter)
    await waitFor(() => onPersistenceError.mock.calls.length === 1)
    expect(onPersistenceError).toHaveBeenCalledWith(error)
  })
})

describe('LokiJSAdapter in-memory fallback', () => {
  it('falls back to memory and reports it when IndexedDB is unavailable (by default)', async () => {
    expect(typeof indexedDB).toBe('undefined')
    const onInMemoryFallback = jest.fn()
    const onSetUpError = jest.fn()
    const adapter = new DatabaseAdapterCompat(makeAdapter({ onInMemoryFallback, onSetUpError }))

    await writeTask(adapter)
    expect(onSetUpError).not.toHaveBeenCalled()
    expect(onInMemoryFallback).toHaveBeenCalledTimes(1)
    expect(onInMemoryFallback.mock.calls[0][0].message).toMatch('IndexedDB is not available')
  })

  it('reports the fallback for each adapter, even if they share options', async () => {
    const onInMemoryFallback = jest.fn()
    const options = {
      dbName: `test${Math.random()}`,
      schema: testSchema,
      useWebWorker: false,
      useIncrementalIndexedDB: true,
      onInMemoryFallback,
    }
    // not using makeAdapter(), so that both adapters get the very same options object
    const adapter1 = new LokiJSAdapter(options)
    const adapter2 = new LokiJSAdapter(options)
    adapters.push(adapter1, adapter2)
    await writeTask(new DatabaseAdapterCompat(adapter1))
    await writeTask(new DatabaseAdapterCompat(adapter2))
    expect(onInMemoryFallback).toHaveBeenCalledTimes(2)
  })

  it('fails setup when IndexedDB is unavailable and allowInMemoryFallback is false', async () => {
    const onInMemoryFallback = jest.fn()
    const error = await new Promise((resolve) => {
      makeAdapter({ allowInMemoryFallback: false, onInMemoryFallback, onSetUpError: resolve })
    })
    expect(error.message).toMatch('IndexedDB is not available')
    expect(onInMemoryFallback).not.toHaveBeenCalled()
  })

  it('sets up in memory even if onInMemoryFallback throws', async () => {
    const onSetUpError = jest.fn()
    const adapter = new DatabaseAdapterCompat(
      makeAdapter({
        onSetUpError,
        onInMemoryFallback: () => {
          throw new Error('fallback handler failed')
        },
      }),
    )
    await writeTask(adapter)
    expect(onSetUpError).not.toHaveBeenCalled()
  })

  it('handles IndexedDB throwing synchronously when opening', async () => {
    const idbError = new Error('The operation is insecure.')
    idbError.name = 'SecurityError'
    global.indexedDB = {
      open: () => {
        throw idbError
      },
    }

    const onInMemoryFallback = jest.fn()
    await writeTask(new DatabaseAdapterCompat(makeAdapter({ onInMemoryFallback })))
    expect(onInMemoryFallback).toHaveBeenCalledTimes(1)
    expect(onInMemoryFallback.mock.calls[0][0].cause).toBe(idbError)

    const setUpError = await new Promise((resolve) => {
      makeAdapter({ allowInMemoryFallback: false, onSetUpError: resolve })
    })
    expect(setUpError.cause).toBe(idbError)
  })

  it('does not hang setup if onQuotaExceededError throws', async () => {
    const idbError = quotaError()
    global.indexedDB = {
      open: () => {
        const request = {}
        setTimeout(() => request.onerror({ target: { error: idbError } }), 0)
        return request
      },
    }
    const onInMemoryFallback = jest.fn()
    await writeTask(
      new DatabaseAdapterCompat(
        makeAdapter({
          onInMemoryFallback,
          onQuotaExceededError: () => {
            throw new Error('quota handler failed')
          },
        }),
      ),
    )
    expect(onInMemoryFallback).toHaveBeenCalledTimes(1)
  })

  it('reports why IndexedDB failed to open', async () => {
    const idbError = quotaError()
    global.indexedDB = {
      open: () => {
        const request = {}
        setTimeout(() => request.onerror({ target: { error: idbError } }), 0)
        return request
      },
    }
    const onQuotaExceededError = jest.fn()

    const onInMemoryFallback = jest.fn()
    const adapter = new DatabaseAdapterCompat(
      makeAdapter({ onInMemoryFallback, onQuotaExceededError }),
    )
    await writeTask(adapter)
    expect(onQuotaExceededError).toHaveBeenCalledWith(idbError)
    expect(onInMemoryFallback).toHaveBeenCalledTimes(1)
    expect(onInMemoryFallback.mock.calls[0][0].cause).toBe(idbError)

    const setUpError = await new Promise((resolve) => {
      makeAdapter({ allowInMemoryFallback: false, onSetUpError: resolve })
    })
    expect(setUpError.cause).toBe(idbError)
  })
})
