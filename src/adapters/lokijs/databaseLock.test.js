import 'fake-indexeddb/auto'
import { LokiMemoryAdapter } from 'lokijs'

import { testSchema, mockTaskRaw } from '../__tests__/helpers'
import logger from '../../utils/common/logger'

import LokiJSAdapter from './index'
import DatabaseAdapterCompat from '../compat'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Mimics the Web Locks API (navigator.locks) shared by all tabs of the same origin
class FakeLockManager {
  held = new Map()

  waiting = new Map()

  requestCount = 0

  request(name, options, callback) {
    this.requestCount += 1
    return new Promise((resolve, reject) => {
      const grant = () => {
        const holder = { reject }
        this.held.set(name, holder)
        Promise.resolve(callback({ name, mode: options.mode })).then(
          (value) => {
            this._release(name, holder)
            resolve(value)
          },
          (error) => {
            this._release(name, holder)
            reject(error)
          },
        )
      }
      if (!this.held.has(name)) {
        grant()
      } else if (options.ifAvailable) {
        Promise.resolve(callback(null)).then(resolve, reject)
      } else {
        this.waiting.set(name, [...(this.waiting.get(name) || []), grant])
      }
    })
  }

  _release(name, holder) {
    if (this.held.get(name) !== holder) {
      return
    }
    this.held.delete(name)
    const [next, ...rest] = this.waiting.get(name) || []
    this.waiting.set(name, rest)
    next && next()
  }

  // The browser releases locks held by a tab when it's closed
  closeHolder(name) {
    this._release(name, this.held.get(name))
  }

  // What happens to the holder when another tab requests the lock with `steal: true`
  steal(name) {
    const holder = this.held.get(name)
    this.held.delete(name)
    holder.reject(new DOMException('Lock broken by another request', 'AbortError'))
  }
}

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

// In-memory incremental persistence adapter. While `holdLoads`/`holdSaves` is set, loads/saves only
// finish when `finishLoad()`/`finishSave()` is called
class HeldLoadAdapter {
  mode = 'incremental'

  holdLoads = false

  finishLoad = null

  saves = 0

  loadDatabase(dbname, callback) {
    const finish = () => {
      this.finishLoad = null
      callback(null)
    }
    if (this.holdLoads) {
      this.finishLoad = finish
    } else {
      finish()
    }
  }

  holdSaves = false

  finishSave = null

  deletes = 0

  saveDatabase(dbname, getLokiCopy, callback) {
    getLokiCopy()
    this.saves += 1
    const finish = () => {
      this.finishSave = null
      callback(null)
    }
    if (this.holdSaves) {
      this.finishSave = finish
    } else {
      setTimeout(finish, 0)
    }
  }

  deleteDatabase(dbname, callback) {
    this.deletes += 1
    callback({ success: true })
  }
}

const originalNavigator = Object.getOwnPropertyDescriptor(global, 'navigator')
const setNavigator = (value) => {
  Object.defineProperty(global, 'navigator', { value, configurable: true, writable: true })
}

let locks
let adapters = []

beforeEach(() => {
  locks = new FakeLockManager()
  setNavigator({ locks })
})

afterEach(() => {
  adapters.forEach((adapter) => {
    const loki = adapter._driver?.loki
    loki && loki.autosaveDisable()
  })
  adapters = []
  if (originalNavigator) {
    Object.defineProperty(global, 'navigator', originalNavigator)
  } else {
    delete global.navigator
  }
})

// Each adapter is like a separate tab of the same app
const openTab = (options) => {
  const lokiAdapter = new LokiJSAdapter({
    dbName: 'app',
    schema: testSchema,
    useWebWorker: false,
    useIncrementalIndexedDB: true,
    _testLokiAdapter: new LokiMemoryAdapter(),
    extraLokiOptions: { autosaveInterval: 5 },
    ...options,
  })
  adapters.push(lokiAdapter)
  return new DatabaseAdapterCompat(lokiAdapter)
}

const isSettled = async (promise) => {
  let settled = false
  promise.then(
    () => {
      settled = true
    },
    () => {
      settled = true
    },
  )
  await sleep(20)
  return settled
}

describe('LokiJSAdapter exclusiveLock', () => {
  it('opens the database in one tab at a time, and calls onDatabaseLockedElsewhere', async () => {
    const tab1 = openTab({ exclusiveLock: true })
    await tab1.getLocal('foo')
    expect(locks.held.has('WatermelonDB:app')).toBe(true)

    const onDatabaseLockedElsewhere = jest.fn()
    const tab2 = openTab({ exclusiveLock: true, onDatabaseLockedElsewhere })
    const tab2Ready = tab2.getLocal('foo')
    expect(await isSettled(tab2Ready)).toBe(false)
    expect(onDatabaseLockedElsewhere).toHaveBeenCalledTimes(1)

    // first tab is closed - second one opens the database
    locks.closeHolder('WatermelonDB:app')
    await tab2Ready
    await tab2.batch([['create', 'tasks', mockTaskRaw({ id: 't1' })]])
    expect(onDatabaseLockedElsewhere).toHaveBeenCalledTimes(1)
  })

  it('waits for the lock without onDatabaseLockedElsewhere', async () => {
    const tab1 = openTab({ exclusiveLock: true })
    await tab1.getLocal('foo')

    const tab2Ready = openTab({ exclusiveLock: true }).getLocal('foo')
    expect(await isSettled(tab2Ready)).toBe(false)

    locks.closeHolder('WatermelonDB:app')
    await tab2Ready
  })

  it('uses a separate lock for each database', async () => {
    await openTab({ exclusiveLock: true }).getLocal('foo')
    await openTab({ exclusiveLock: true, dbName: 'other' }).getLocal('foo')
    expect(Array.from(locks.held.keys())).toEqual(['WatermelonDB:app', 'WatermelonDB:other'])
  })

  it('stops saving and rejects changes when the lock is lost', async () => {
    const _onFatalError = jest.fn()
    const tab = openTab({ exclusiveLock: true, _onFatalError })
    await tab.batch([['create', 'tasks', mockTaskRaw({ id: 't1' })]])

    locks.steal('WatermelonDB:app')
    await sleep(0)

    expect(_onFatalError).toHaveBeenCalledTimes(1)
    expect(_onFatalError.mock.calls[0][0].name).toBe('DatabaseLockLostError')
    expect(adapters[0]._driver.loki.autosave).toBe(false)
    await expect(tab.batch([['create', 'tasks', mockTaskRaw({ id: 't2' })]])).rejects.toThrow(
      'broken',
    )
  })

  it('logs errors thrown by callbacks when the lock is lost', async () => {
    const unhandledRejections = []
    const onUnhandledRejection = (reason) => unhandledRejections.push(reason)
    process.on('unhandledRejection', onUnhandledRejection)
    try {
      const _onFatalError = jest.fn(() => {
        throw new Error('app callback failed')
      })
      const tab = openTab({ exclusiveLock: true, _onFatalError })
      await tab.getLocal('foo')

      locks.steal('WatermelonDB:app')
      await sleep(10)

      expect(_onFatalError).toHaveBeenCalledTimes(1)
      expect(unhandledRejections).toEqual([])
      await expect(tab.batch([['create', 'tasks', mockTaskRaw({ id: 't1' })]])).rejects.toThrow(
        'broken',
      )
    } finally {
      process.off('unhandledRejection', onUnhandledRejection)
    }
  })

  it('does not save or set up a database that was loading when the lock was lost', async () => {
    const persistenceAdapter = new HeldLoadAdapter()
    persistenceAdapter.holdLoads = true
    const _onFatalError = jest.fn()
    const onSetUpError = jest.fn()
    const tab = openTab({
      exclusiveLock: true,
      _onFatalError,
      onSetUpError,
      _testLokiAdapter: persistenceAdapter,
    })
    const afterSetUp = tab.getLocal('foo')
    await waitFor(() => persistenceAdapter.finishLoad)

    locks.steal('WatermelonDB:app')
    await sleep(0)
    persistenceAdapter.finishLoad()

    await expect(afterSetUp).rejects.toThrow('driver is not set up')
    expect(onSetUpError).toHaveBeenCalledTimes(1)
    expect(onSetUpError.mock.calls[0][0].message).toMatch('broken')
    expect(_onFatalError).toHaveBeenCalledTimes(1)
    expect(adapters[0]._driver).toBe(undefined)
    expect(persistenceAdapter.saves).toBe(0)
  })

  it('does not save a database that was reloading during reset when the lock was lost', async () => {
    const persistenceAdapter = new HeldLoadAdapter()
    const tab = openTab({ exclusiveLock: true, _testLokiAdapter: persistenceAdapter })
    await tab.batch([['create', 'tasks', mockTaskRaw({ id: 't1' })]])
    const driver = adapters[0]._driver

    persistenceAdapter.holdLoads = true
    const reset = tab.unsafeResetDatabase()
    await waitFor(() => persistenceAdapter.finishLoad)
    const savesBeforeReload = persistenceAdapter.saves
    locks.steal('WatermelonDB:app')
    await sleep(0)
    persistenceAdapter.finishLoad()

    await expect(reset).rejects.toThrow('broken')
    // the reloaded database is not set up and never saved
    expect(driver.loki.autosave).toBe(false)
    expect(driver.loki.getCollection('tasks')).toBe(null)
    await sleep(30)
    expect(persistenceAdapter.saves).toBe(savesBeforeReload)
  })

  it('does not delete the database if the lock is lost while reset waits for a save', async () => {
    const persistenceAdapter = new HeldLoadAdapter()
    const tab = openTab({ exclusiveLock: true, _testLokiAdapter: persistenceAdapter })
    await tab.getLocal('foo')

    persistenceAdapter.holdSaves = true
    await tab.batch([['create', 'tasks', mockTaskRaw({ id: 't1' })]])
    await waitFor(() => persistenceAdapter.finishSave)
    // (an empty database is reset during setup)
    const deletesBeforeReset = persistenceAdapter.deletes
    const reset = tab.unsafeResetDatabase()
    await sleep(10)

    locks.steal('WatermelonDB:app')
    await sleep(0)
    persistenceAdapter.finishSave()

    await expect(reset).rejects.toThrow('broken')
    expect(persistenceAdapter.deletes).toBe(deletesBeforeReset)
  })

  it(`uses Loki's default database name for the lock if dbName is not passed`, async () => {
    await openTab({ exclusiveLock: true, dbName: undefined }).getLocal('foo')
    expect(Array.from(locks.held.keys())).toEqual(['WatermelonDB:loki.db'])

    const sameDatabase = openTab({ exclusiveLock: true, dbName: 'loki.db' }).getLocal('foo')
    expect(await isSettled(sameDatabase)).toBe(false)
  })

  describe('with IndexedDB', () => {
    // Like openTab(), but persisted to (fake) IndexedDB using IncrementalIndexedDBAdapter
    const openIdbTab = (dbName, options) =>
      openTab({ dbName, _testLokiAdapter: undefined, exclusiveLock: true, ...options })

    const lokiOf = (index) => adapters[index]._driver.loki

    const closeTab = async (index) => {
      const loki = lokiOf(index)
      await waitFor(() => !loki.autosaveDirty() && !loki.throttledSavePending)
      loki.autosaveDisable()
      locks.closeHolder(`WatermelonDB:${loki.filename}`)
    }

    it('hands the database over to a waiting tab with all saved changes', async () => {
      const dbName = `test${Math.random()}`
      const tab1 = openIdbTab(dbName)
      await tab1.batch([['create', 'tasks', mockTaskRaw({ id: 't1' })]])

      const tab2 = openIdbTab(dbName)
      const tab2Ready = tab2.getLocal('foo')
      await tab1.batch([['create', 'tasks', mockTaskRaw({ id: 't2' })]])
      expect(await isSettled(tab2Ready)).toBe(false)

      await closeTab(0)
      await tab2Ready
      expect((await tab2.find('tasks', 't1')).id).toBe('t1')
      expect((await tab2.find('tasks', 't2')).id).toBe('t2')
    })

    it(`does not overwrite the new holder's changes after losing the lock`, async () => {
      const dbName = `test${Math.random()}`
      const tab1 = openIdbTab(dbName)
      await tab1.batch([['create', 'tasks', mockTaskRaw({ id: 't1' })]])
      await waitFor(() => !lokiOf(0).autosaveDirty() && !lokiOf(0).throttledSavePending)

      // tab1 has unsaved changes (and maybe a save in flight) when another tab takes over
      await tab1.batch([['create', 'tasks', mockTaskRaw({ id: 'unsaved' })]])
      const tab2 = openIdbTab(dbName)
      const tab2Ready = tab2.getLocal('foo')
      locks.steal(`WatermelonDB:${dbName}`)
      locks.closeHolder(`WatermelonDB:${dbName}`)
      await tab2Ready

      await tab2.batch([['destroyPermanently', 'tasks', 't1']])
      await tab2.batch([['create', 'tasks', mockTaskRaw({ id: 't2' })]])
      await expect(tab1.batch([['create', 'tasks', mockTaskRaw({ id: 't3' })]])).rejects.toThrow(
        'broken',
      )
      await sleep(50)
      await closeTab(1)

      const tab3 = openIdbTab(dbName)
      expect(await tab3.find('tasks', 't1')).toBe(null)
      expect((await tab3.find('tasks', 't2')).id).toBe('t2')
      expect(await tab3.find('tasks', 't3')).toBe(null)
    })

    it(`does not delete the new holder's database when reset loses the lock`, async () => {
      const dbName = `test${Math.random()}`
      const tab1 = openIdbTab(dbName)
      await tab1.batch([['create', 'tasks', mockTaskRaw({ id: 't1' })]])

      // reset waits for the in-flight save, and loses the lock in the meantime
      const reset = tab1.unsafeResetDatabase()
      const tab2 = openIdbTab(dbName)
      const tab2Ready = tab2.getLocal('foo')
      locks.steal(`WatermelonDB:${dbName}`)
      locks.closeHolder(`WatermelonDB:${dbName}`)
      await reset.catch(() => {})
      await tab2Ready
      await tab2.batch([['create', 'tasks', mockTaskRaw({ id: 't2' })]])
      await sleep(50)
      await closeTab(1)

      const tab3 = openIdbTab(dbName)
      expect((await tab3.find('tasks', 't2')).id).toBe('t2')
    })
  })

  it('opens the database without a lock if Web Locks API is not available', async () => {
    const warn = jest.spyOn(logger, 'warn')
    setNavigator({})
    await openTab({ exclusiveLock: true }).getLocal('foo')
    await openTab({ exclusiveLock: true }).getLocal('foo')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Web Locks API'))
  })

  it('does not use locks unless enabled', async () => {
    await openTab({}).getLocal('foo')
    await openTab({}).getLocal('foo')
    expect(locks.requestCount).toBe(0)
  })
})
