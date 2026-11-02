import 'fake-indexeddb/auto'

import { appSchema, tableSchema } from '../../Schema'
import {
  schemaMigrations,
  createTable,
  destroyTable,
  unsafeExecuteSql,
  unsafeExecuteLoki,
} from '../../Schema/migrations'
import logger from '../../utils/common/logger'
import Model from '../../Model'
import Query from '../../Query'

import Loki from 'lokijs'

import LokiJSAdapter from './index'
import { destroyCollection } from './worker/lokiExtensions'
import DatabaseAdapterCompat from '../compat'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const waitFor = async (predicate) => {
  for (let i = 0; i < 200; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await predicate()) {
      return
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(5)
  }
  throw new Error('Timed out waiting for condition')
}

const getPersistedKeys = (dbName) =>
  new Promise((resolve, reject) => {
    const openRequest = indexedDB.open(dbName)
    openRequest.onerror = () => reject(openRequest.error)
    openRequest.onsuccess = () => {
      const db = openRequest.result
      const request = db
        .transaction(['LokiIncrementalData'], 'readonly')
        .objectStore('LokiIncrementalData')
        .getAllKeys()
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        db.close()
        resolve(request.result)
      }
    }
  })

const chunksOf = (keys, table) => keys.filter((key) => key.startsWith(`${table}.`)).sort()

const tasksSchema = { name: 'tasks', columns: [{ name: 'name', type: 'string' }] }
const commentsSchema = { name: 'comments', columns: [{ name: 'body', type: 'string' }] }

const bothTables = (version) =>
  appSchema({ version, tables: [tableSchema(tasksSchema), tableSchema(commentsSchema)] })
const schemaV1 = bothTables(1)
const schemaV2 = appSchema({ version: 2, tables: [tableSchema(tasksSchema)] })

let openAdapters = []

const openAdapter = async (dbName, schema, migrations) => {
  const lokiAdapter = new LokiJSAdapter({
    dbName,
    schema,
    migrations: migrations && schemaMigrations({ migrations }),
    useWebWorker: false,
    useIncrementalIndexedDB: true,
    extraLokiOptions: { autosaveInterval: 5 },
  })
  openAdapters.push(lokiAdapter)
  const adapter = new DatabaseAdapterCompat(lokiAdapter)
  // wait for setup
  await adapter.getLocal('foo')
  return { adapter, loki: lokiAdapter._driver.loki }
}

// Waits until all changes are saved, and stops saving (like closing the page)
const closeAdapter = async ({ loki }) => {
  await waitFor(() => !loki.autosaveDirty())
  await new Promise((resolve) => loki.throttledSaveDrain(resolve))
  loki.autosaveDisable()
}

const comments = (count, prefix) =>
  Array.from({ length: count }, (_, i) => [
    'create',
    'comments',
    { id: `${prefix}${i}`, body: prefix, _status: '', _changed: '' },
  ])

class MockComment extends Model {
  static table = 'comments'
}

const countComments = (adapter) =>
  adapter.count(new Query({ modelClass: MockComment }, []).serialize())

afterEach(() => {
  openAdapters.forEach((lokiAdapter) => {
    const loki = lokiAdapter._driver?.loki
    loki && loki.autosaveDisable()
  })
  openAdapters = []
})

describe('LokiJSAdapter migrations', () => {
  it('warns about each ignored unsafeExecuteSql() step', async () => {
    const warn = jest.spyOn(logger, 'warn')
    const dbName = `test${Math.random()}`
    await closeAdapter(await openAdapter(dbName, schemaV1))

    await openAdapter(dbName, bothTables(2), [
      {
        toVersion: 2,
        steps: [unsafeExecuteSql('drop table comments;'), unsafeExecuteSql('vacuum;')],
      },
    ])

    const sqlWarnings = warn.mock.calls.filter(([message]) => message.includes('unsafeExecuteSql'))
    expect(sqlWarnings.length).toBe(2)
    expect(sqlWarnings[0][0]).toContain('drop table comments;')
    expect(sqlWarnings[1][0]).toContain('vacuum;')
  })

  it('executes unsafeExecuteLoki() steps against the Loki instance', async () => {
    const dbName = `test${Math.random()}`
    const v1 = await openAdapter(dbName, schemaV1)
    await v1.adapter.batch([
      ['create', 'tasks', { id: 't1', name: 'before', _status: '', _changed: '' }],
    ])
    await closeAdapter(v1)

    let executedWith = null
    const v2 = await openAdapter(dbName, bothTables(2), [
      {
        toVersion: 2,
        steps: [
          unsafeExecuteLoki((loki) => {
            executedWith = loki
            loki.getCollection('tasks').findAndUpdate({}, (raw) => {
              raw.name = 'after'
            })
          }),
        ],
      },
    ])
    expect(executedWith).toBe(v2.loki)
    expect((await v2.adapter.find('tasks', 't1')).name).toBe('after')
  })

  it('does not save changes made by a migration that fails', async () => {
    const dbName = `test${Math.random()}`
    const v1 = await openAdapter(dbName, schemaV1)
    await v1.adapter.batch([
      ['create', 'tasks', { id: 't1', name: 'before', _status: '', _changed: '' }],
    ])
    await closeAdapter(v1)

    const failingMigration = new LokiJSAdapter({
      dbName,
      schema: bothTables(2),
      migrations: schemaMigrations({
        migrations: [
          {
            toVersion: 2,
            steps: [
              unsafeExecuteLoki((loki) => {
                loki.getCollection('tasks').findAndUpdate({}, (raw) => {
                  raw.name = 'partially migrated'
                })
                loki.getCollection('local_storage').insert({ key: 'foo', value: 'bar' })
                throw new Error('Migration step failed')
              }),
            ],
          },
        ],
      }),
      useWebWorker: false,
      useIncrementalIndexedDB: true,
      extraLokiOptions: { autosaveInterval: 5 },
      onSetUpError: () => {},
    })
    openAdapters.push(failingMigration)
    await expect(new DatabaseAdapterCompat(failingMigration).getLocal('foo')).rejects.toThrow()
    await sleep(50)

    // still at version 1, unchanged
    const reopened = await openAdapter(dbName, schemaV1)
    expect((await reopened.adapter.find('tasks', 't1')).name).toBe('before')
    expect(await reopened.adapter.getLocal('foo')).toBe(null)
  })

  it('warns if it cannot delete persisted data of a destroyed table', () => {
    const warn = jest.spyOn(logger, 'warn')
    // an incremental adapter that's not IncrementalIndexedDBAdapter
    const persistenceAdapter = { mode: 'incremental', saveDatabase: () => {} }
    const loki = new Loki('test', { adapter: persistenceAdapter })
    loki.addCollection('comments')

    destroyCollection(loki, 'comments')

    expect(loki.getCollection('comments')).toBe(null)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Cannot delete persisted data of destroyed table comments'),
    )
  })

  it('rejects unsafeExecuteLoki() steps with useWebWorker: true', () => {
    expect(
      () =>
        new LokiJSAdapter({
          schema: bothTables(2),
          migrations: schemaMigrations({
            migrations: [{ toVersion: 2, steps: [unsafeExecuteLoki(() => {})] }],
          }),
          useWebWorker: true,
          useIncrementalIndexedDB: true,
        }),
    ).toThrow('not supported with LokiJSAdapter { useWebWorker: true }')
  })

  it('destroys tables, deleting their data from IndexedDB', async () => {
    const dbName = `test${Math.random()}`
    const v1 = await openAdapter(dbName, schemaV1)
    await v1.adapter.batch([
      ['create', 'tasks', { id: 't1', name: 'task', _status: '', _changed: '' }],
      ...comments(150, 'c'),
    ])
    await closeAdapter(v1)
    expect(chunksOf(await getPersistedKeys(dbName), 'comments')).toEqual([
      'comments.chunk.0',
      'comments.chunk.1',
      'comments.metadata',
    ])

    const migrations = [{ toVersion: 2, steps: [destroyTable({ table: 'comments' })] }]
    const v2 = await openAdapter(dbName, schemaV2, migrations)
    expect(v2.loki.getCollection('comments')).toBe(null)
    await closeAdapter(v2)

    const keys = await getPersistedKeys(dbName)
    expect(chunksOf(keys, 'comments')).toEqual([])
    expect(chunksOf(keys, 'tasks')).toEqual(['tasks.chunk.0', 'tasks.metadata'])

    // loads fine after that
    const reopened = await openAdapter(dbName, schemaV2, migrations)
    expect(reopened.loki.getCollection('comments')).toBe(null)
    expect((await reopened.adapter.find('tasks', 't1')).name).toBe('task')
  })

  it('deletes leftover data of tables that are already gone from Loki', async () => {
    const dbName = `test${Math.random()}`
    const v1 = await openAdapter(dbName, schemaV1)
    await v1.adapter.batch(comments(10, 'c'))
    await closeAdapter(v1)

    // e.g. collection removed by an older app version or by unsafeExecuteLoki, but its chunks remain
    const v2 = await openAdapter(dbName, schemaV2, [
      {
        toVersion: 2,
        steps: [
          unsafeExecuteLoki((loki) => {
            loki.collections = loki.collections.filter(({ name }) => name !== 'comments')
          }),
          destroyTable({ table: 'comments' }),
        ],
      },
    ])
    await closeAdapter(v2)
    expect(chunksOf(await getPersistedKeys(dbName), 'comments')).toEqual([])
  })

  it('keeps the old data if saving a destroyed table fails, and deletes it on retry', async () => {
    const dbName = `test${Math.random()}`
    const v1 = await openAdapter(dbName, schemaV1)
    await v1.adapter.batch(comments(250, 'old'))
    await closeAdapter(v1)
    const oldChunks = [
      'comments.chunk.0',
      'comments.chunk.1',
      'comments.chunk.2',
      'comments.metadata',
    ]

    // saving fails (and the IndexedDB transaction is aborted) until `failSaves` is unset
    let failSaves = true
    let failedSaves = 0
    const { put } = IDBObjectStore.prototype
    jest.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (...args) {
      if (failSaves) {
        failedSaves += 1
        throw new Error('Simulated IndexedDB failure')
      }
      return put.apply(this, args)
    })

    const migrations = [
      {
        toVersion: 2,
        steps: [destroyTable({ table: 'comments' }), createTable(commentsSchema)],
      },
    ]
    const schema = bothTables(2)
    const v2 = await openAdapter(dbName, schema, migrations)
    await v2.adapter.batch(comments(150, 'new'))
    await waitFor(() => failedSaves >= 2)
    await sleep(20)

    // nothing was deleted by failed saves
    expect(chunksOf(await getPersistedKeys(dbName), 'comments')).toEqual(oldChunks)

    // retry succeeds
    failSaves = false
    await waitFor(() => !v2.loki.autosaveDirty())
    await v2.adapter.batch(comments(1, 'newer'))
    await closeAdapter(v2)

    expect(chunksOf(await getPersistedKeys(dbName), 'comments')).toEqual([
      'comments.chunk.0',
      'comments.chunk.1',
      'comments.metadata',
    ])
    const reopened = await openAdapter(dbName, schema, migrations)
    expect(await countComments(reopened.adapter)).toBe(151)
  })

  it('destroys and creates a table again in one migration', async () => {
    const dbName = `test${Math.random()}`
    const v1 = await openAdapter(dbName, schemaV1)
    await v1.adapter.batch(comments(250, 'old'))
    await closeAdapter(v1)

    const migrations = [
      {
        toVersion: 2,
        steps: [destroyTable({ table: 'comments' }), createTable(commentsSchema)],
      },
    ]
    const schema = bothTables(2)
    const v2 = await openAdapter(dbName, schema, migrations)
    expect(await countComments(v2.adapter)).toBe(0)
    await v2.adapter.batch(comments(150, 'new'))
    await waitFor(() => !v2.loki.autosaveDirty())
    // a later save only touches the last chunk - the first one must not be deleted again
    await v2.adapter.batch(comments(1, 'newer'))
    await closeAdapter(v2)

    expect(chunksOf(await getPersistedKeys(dbName), 'comments')).toEqual([
      'comments.chunk.0',
      'comments.chunk.1',
      'comments.metadata',
    ])
    const reopened = await openAdapter(dbName, schema, migrations)
    expect(await countComments(reopened.adapter)).toBe(151)
  })
})
