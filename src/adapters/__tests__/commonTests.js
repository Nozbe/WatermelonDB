import expect from 'expect'
import naughtyStrings from 'big-list-of-naughty-strings'

import Model from '../../Model'
import Query from '../../Query'
import { sanitizedRaw } from '../../RawRecord'
import * as Q from '../../QueryDescription'
import { appSchema, tableSchema } from '../../Schema'
import { schemaMigrations, createTable, addColumns } from '../../Schema/migrations'

import { matchTests, naughtyMatchTests, joinTests } from '../../__tests__/databaseTests'
import DatabaseAdapterCompat from '../compat'
import {
  testSchema,
  taskQuery,
  mockTaskRaw,
  performMatchTest,
  performJoinTest,
  expectSortedEqual,
  MockTask,
  mockProjectRaw,
  projectQuery,
} from './helpers'

class BadModel extends Model {
  static table = 'nonexistent'
}

export default () => [
  [
    'validates adapter options',
    async (_adapter, AdapterClass) => {
      const schema = { ...testSchema, version: 10 }

      const makeAdapter = options => new AdapterClass({ schema, ...options })
      const adapterWithMigrations = migrations => makeAdapter({ migrations })

      // expect(() => makeAdapter({})).toThrowError(/missing migrations/)

      expect(() => makeAdapter({ migrationsExperimental: [] })).toThrow(
        /`migrationsExperimental` option has been renamed to `migrations`/,
      )

      if (AdapterClass.name === 'LokiJSAdapter') {
        expect(() => makeAdapter({ experimentalUseIncrementalIndexedDB: false })).toThrow(
          /LokiJSAdapter `experimentalUseIncrementalIndexedDB` option has been renamed/,
        )
      }

      expect(() => adapterWithMigrations({ migrations: [] })).toThrow(/use schemaMigrations()/)

      // OK migrations passed
      const adapterWithRealMigrations = migrations =>
        adapterWithMigrations(schemaMigrations({ migrations }))

      expect(() => adapterWithRealMigrations([{ toVersion: 10, steps: [] }])).not.toThrow()
      expect(() =>
        adapterWithRealMigrations([{ toVersion: 10, steps: [] }, { toVersion: 9, steps: [] }]),
      ).not.toThrow()

      // Empty migrations only allowed if version 1
      expect(
        () =>
          new AdapterClass({
            schema: { ...testSchema, version: 1 },
            migrations: schemaMigrations({ migrations: [] }),
          }),
      ).not.toThrow()
      expect(() => adapterWithRealMigrations([])).toThrow(/Missing migration/)

      // Migrations can't be newer than schema
      expect(() => adapterWithRealMigrations([{ toVersion: 11, steps: [] }])).toThrow(
        /migrations can't be newer than schema/i,
      )
      // Migration to latest version must be present
      expect(() =>
        adapterWithRealMigrations([{ toVersion: 9, steps: [] }, { toVersion: 8, steps: [] }]),
      ).toThrow(/Missing migration/)
    },
  ],
  [
    'can query and count on empty db',
    async adapter => {
      const query = taskQuery()
      expect(await adapter.query(query)).toEqual([])
      expect(await adapter.count(query)).toBe(0)
    },
  ],
  [
    'can create and find records (sanity test)',
    async adapter => {
      const record = mockTaskRaw({ id: 'abc', text1: 'bar', order: 1 })
      await adapter.batch([['create', 'tasks', record]])
      expect(await adapter.find('tasks', 'abc')).toBe('abc')
    },
  ],
  [
    'can find records by ID',
    async _adapter => {
      let adapter = _adapter

      // add a record
      const s1 = mockTaskRaw({ id: 's1', text1: 'bar', order: 1 })
      await adapter.batch([['create', 'tasks', s1]])

      // returns cached ID after create
      expect(await adapter.find('tasks', 's1')).toBe('s1')

      // add more, restart app
      const s2 = mockTaskRaw({ id: 's2', bool1: true, order: 2 })
      const s3 = mockTaskRaw({ id: 's3', text1: 'baz' })
      await adapter.batch([['create', 'tasks', s2], ['create', 'tasks', s3]])
      adapter = await adapter.testClone()

      // returns raw if not cached
      expect(await adapter.find('tasks', 's2')).toEqual(s2)
      expect(await adapter.find('tasks', 's3')).toEqual(s3)

      // caches records after first find
      expect(await adapter.find('tasks', 's2')).toBe('s2')

      // returns null if not found
      expect(await adapter.find('tasks', 's4')).toBe(null)
    },
  ],
  [
    'can cache non-global IDs on find',
    async _adapter => {
      let adapter = _adapter

      // add a record
      const s1 = mockTaskRaw({ id: 'id1', text1: 'bar', order: 1 })
      await adapter.batch([['create', 'tasks', s1]])

      // returns null if not found in a different table
      expect(await adapter.find('projects', 'id1')).toBe(null)

      const p1 = mockProjectRaw({ id: 'id1', num1: 1, text1: 'foo' })
      await adapter.batch([['create', 'projects', p1]])

      // returns cached ID after create
      expect(await adapter.find('projects', 'id1')).toBe('id1')

      // add more project, restart app
      const p2 = mockProjectRaw({ id: 'id2', num1: 1, text1: 'foo' })
      await adapter.batch([['create', 'projects', p2]])
      adapter = await adapter.testClone()

      const s2 = mockTaskRaw({ id: 'id2', text1: 'baz', order: 2 })
      await adapter.batch([['create', 'tasks', s2]])

      // returns cached ID after create
      expect(await adapter.find('tasks', 'id2')).toBe('id2')

      // returns raw if not cached for a different table
      expect(await adapter.find('projects', 'id2')).toEqual(p2)
      // returns cached ID after previous find
      expect(await adapter.find('projects', 'id2')).toBe('id2')
    },
  ],
  [
    'can cache non-global IDs on query',
    async _adapter => {
      let adapter = _adapter

      // add a record
      const s1 = mockTaskRaw({ id: 'id1', text1: 'bar', order: 1 })
      await adapter.batch([['create', 'tasks', s1]])

      // returns empty array
      expectSortedEqual(await adapter.query(projectQuery()), [])

      const p1 = mockProjectRaw({ id: 'id1', num1: 1, text1: 'foo' })
      await adapter.batch([['create', 'projects', p1]])

      // returns cached ID after create
      expectSortedEqual(await adapter.query(projectQuery()), ['id1'])

      // add more project, restart app
      const p2 = mockProjectRaw({ id: 'id2', num1: 1, text1: 'foo' })
      await adapter.batch([['create', 'projects', p2]])
      adapter = await adapter.testClone()

      const s2 = mockTaskRaw({ id: 'id2', text1: 'baz', order: 2 })
      await adapter.batch([['create', 'tasks', s2]])

      // returns cached IDs after create
      expectSortedEqual(await adapter.query(taskQuery()), [s1, 'id2'])

      // returns raw if not cached for a different table
      expectSortedEqual(await adapter.query(projectQuery()), [p1, p2])
      // returns cached IDs after previous query
      expectSortedEqual(await adapter.query(taskQuery()), ['id1', 'id2'])
    },
  ],
  [
    'sanitizes records on find',
    async _adapter => {
      let adapter = _adapter
      const tt1 = { id: 'tt1', task_id: 'abcdef' } // Unsanitized raw!

      await adapter.batch([['create', 'tag_assignments', tt1]])
      adapter = await adapter.testClone()

      expect(await adapter.find('tag_assignments', 'tt1')).toEqual(
        sanitizedRaw(tt1, testSchema.tables.tag_assignments),
      )
    },
  ],
  [
    'can query and count records',
    async adapter => {
      const record1 = mockTaskRaw({ id: 't1', text1: 'bar', bool1: false, order: 1 })
      const record2 = mockTaskRaw({ id: 't2', text1: 'baz', bool1: true, order: 2 })
      const record3 = mockTaskRaw({ id: 't3', text1: 'abc', bool1: false, order: 3 })

      await adapter.batch([
        ['create', 'tasks', record1],
        ['create', 'tasks', record2],
        ['create', 'tasks', record3],
      ])

      // all records
      expectSortedEqual(await adapter.query(taskQuery()), ['t1', 't2', 't3'])
      expect(await adapter.count(taskQuery())).toBe(3)

      // some records
      expectSortedEqual(await adapter.query(taskQuery(Q.where('bool1', false))), ['t1', 't3'])
      expectSortedEqual(await adapter.query(taskQuery(Q.where('order', 2))), ['t2'])
      expectSortedEqual(await adapter.query(taskQuery(Q.where('order', 3))), ['t3'])

      expect(await adapter.count(taskQuery(Q.where('bool1', false)))).toBe(2)

      // no records
      expectSortedEqual(await adapter.query(taskQuery(Q.where('text1', 'nope'))), [])
      expect(await adapter.count(taskQuery(Q.where('text1', 'nope')))).toBe(0)
      expect(await adapter.count(taskQuery(Q.where('order', 4)))).toBe(0)
    },
  ],
  [
    'can query records in raw query format',
    async (adapter, AdapterClass) => {
      if (AdapterClass.name === 'SQLiteAdapter') {
        const record1 = mockTaskRaw({ id: 't1', text1: 'bar', bool1: false, order: 1 })
        const record2 = mockTaskRaw({ id: 't2', text1: 'baz', bool1: true, order: 2 })
        const record3 = mockTaskRaw({ id: 't3', text1: 'abc', bool1: false, order: 3 })

        await adapter.batch([
          ['create', 'tasks', record1],
          ['create', 'tasks', record2],
          ['create', 'tasks', record3],
        ])

        // all records
        expectSortedEqual(await adapter.unsafeSqlQuery('tasks', `SELECT * FROM tasks`), [
          't1',
          't2',
          't3',
        ])

        expectSortedEqual(
          await adapter.unsafeSqlQuery('tasks', `SELECT * FROM tasks WHERE bool1 = 0`),
          ['t1', 't3'],
        )

        expectSortedEqual(
          await adapter.unsafeSqlQuery('tasks', `SELECT * FROM tasks WHERE id = 't2'`),
          ['t2'],
        )

        expectSortedEqual(
          await adapter.unsafeSqlQuery('tasks', `SELECT * FROM tasks WHERE \`order\` = 2`),
          ['t2'],
        )

        expectSortedEqual(
          await adapter.unsafeSqlQuery('tasks', `SELECT * FROM tasks WHERE text1 = 'nope'`),
          [],
        )
      } else {
        expect(adapter.unsafeSqlQuery).toBe(undefined)
      }
    },
  ],
  [
    'compacts query results',
    async _adapter => {
      let adapter = _adapter
      const queryAll = () => adapter.query(taskQuery())

      // add records, restart app
      const s1 = mockTaskRaw({ id: 's1', order: 1 })
      const s2 = mockTaskRaw({ id: 's2', order: 2 })
      await adapter.batch([['create', 'tasks', s1], ['create', 'tasks', s2]])
      adapter = await adapter.testClone()

      // first time we see it, get full object
      expectSortedEqual(await queryAll(), [s1, s2])

      // cached next time
      expect(await queryAll()).toEqual(['s1', 's2'])

      // updating doesn't change anything
      await adapter.batch([['update', 'tasks', s2]])
      expect(await queryAll()).toEqual(['s1', 's2'])

      // records added via adapter get cached automatically
      const s3 = mockTaskRaw({ id: 's3' })
      await adapter.batch([['create', 'tasks', s3]])
      expect(await queryAll()).toEqual(['s1', 's2', 's3'])

      // remove and re-add and it appears again
      await adapter.batch([['destroyPermanently', 'tasks', s3.id]])
      expect(await queryAll()).toEqual(['s1', 's2'])

      const s3New = mockTaskRaw({ id: 's3', bool1: true })
      await adapter.batch([['create', 'tasks', s3New]])
      expect(await queryAll()).toEqual(['s1', 's2', 's3'])

      // restart app, doesn't have the records
      adapter = await adapter.testClone()
      expectSortedEqual(await queryAll(), [s1, s2, s3New])
    },
  ],
  [
    'sanitizes records on query',
    async _adapter => {
      let adapter = _adapter
      // Unsanitized raw!
      const t1 = { id: 't1', text1: 'foo', order: 1 }
      const t2 = { id: 't2', text2: 'bar', order: 2 }

      await adapter.batch([['create', 'tasks', t1], ['create', 'tasks', t2]])
      adapter = await adapter.testClone()

      expectSortedEqual(await adapter.query(taskQuery()), [
        sanitizedRaw(t1, testSchema.tables.tasks),
        sanitizedRaw(t2, testSchema.tables.tasks),
      ])
    },
  ],
  [
    'returns a COPY of the data',
    async _adapter => {
      let adapter = _adapter
      const raw = mockTaskRaw({ id: 't1', text1: 'bar' })
      const originalRaw = { ...raw }
      await adapter.batch([['create', 'tasks', raw]])

      adapter = await adapter.testClone()
      const fetchedRaw = await adapter.find('tasks', 't1')

      // data is equal but not the same reference
      expect(fetchedRaw).toEqual(originalRaw)
      expect(fetchedRaw).toEqual(raw)
      expect(fetchedRaw).not.toBe(raw)

      // make sure same is true for query
      adapter = await adapter.testClone()
      const [queriedRaw] = await adapter.query(taskQuery())
      expect(queriedRaw).toEqual(originalRaw)
      expect(queriedRaw).not.toBe(raw)
    },
  ],
  [
    'can update records',
    async _adapter => {
      let adapter = _adapter
      const raw = mockTaskRaw({ id: 't1', text1: 'bar' })
      await adapter.batch([['create', 'tasks', raw]])
      raw.bool1 = true
      raw.order = 2
      await adapter.batch([['update', 'tasks', raw]])

      adapter = await adapter.testClone()
      const fetchedUpdatedRaw = await adapter.find('tasks', 't1')

      // check raws are equal (but a copy)
      expect(fetchedUpdatedRaw.bool1).toBe(true)
      expect(fetchedUpdatedRaw.order).toBe(2)
      expect(fetchedUpdatedRaw).toEqual(raw)
      expect(fetchedUpdatedRaw).not.toBe(raw)
    },
  ],
  [
    'can mark records as deleted',
    async adapter => {
      const m1 = mockTaskRaw({ id: 't1', text1: 'bar1' })
      await adapter.batch([['create', 'tasks', m1]])
      expect(await adapter.query(taskQuery())).toEqual(['t1'])

      await adapter.batch([['markAsDeleted', 'tasks', m1.id]])
      expect(await adapter.query(taskQuery())).toEqual([])

      // Check that the record is removed from cache
      // HACK: Set _status to reveal the record in query (if record was cached, there would only be ID)
      m1._status = 'synced'
      await adapter.batch([['update', 'tasks', m1]])
      expectSortedEqual(await adapter.query(taskQuery()), [m1])
    },
  ],
  [
    'can get deleted record ids',
    async adapter => {
      const m1 = mockTaskRaw({ id: 't1', text1: 'bar1', order: 1 })
      const m2 = mockTaskRaw({ id: 't2', text1: 'bar2', order: 2 })
      await adapter.batch([
        ['create', 'tasks', m1],
        ['markAsDeleted', 'tasks', m1.id],
        ['create', 'tasks', m2],
        ['create', 'tasks', mockTaskRaw({ id: 't3', text1: 'bar3' })],
        ['markAsDeleted', 'tasks', m2.id],
      ])
      expectSortedEqual(await adapter.getDeletedRecords('tasks'), ['t2', 't1'])
    },
  ],
  [
    'can destroy deleted records',
    async adapter => {
      const m1 = mockTaskRaw({ id: 't1', text1: 'bar1', order: 1 })
      const m2 = mockTaskRaw({ id: 't2', text1: 'bar2', order: 2 })
      const m3 = mockTaskRaw({ id: 't3', text1: 'bar3', order: 3 })
      await adapter.batch([
        ['create', 'tasks', m1],
        ['create', 'tasks', m2],
        ['create', 'tasks', m3],
        ['create', 'tasks', mockTaskRaw({ id: 't4', text1: 'bar4' })],
      ])
      await adapter.batch([
        ['markAsDeleted', 'tasks', m1.id],
        ['markAsDeleted', 'tasks', m2.id],
        ['markAsDeleted', 'tasks', m3.id],
      ])

      await adapter.destroyDeletedRecords('tasks', ['t1', 't2'])
      expectSortedEqual(await adapter.getDeletedRecords('tasks'), ['t3'])
      expectSortedEqual(await adapter.query(taskQuery()), ['t4'])
      expect(await adapter.find('tasks', 't1')).toBeNull()
      expect(await adapter.find('tasks', 't2')).toBeNull()
    },
  ],
  [
    'can run mixed batches',
    async _adapter => {
      let adapter = _adapter
      const m1 = mockTaskRaw({ id: 't1', text1: 'bar' })
      const m3 = mockTaskRaw({ id: 't3' })
      const m4 = mockTaskRaw({ id: 't4' })

      await adapter.batch([['create', 'tasks', m1]])

      m1.bool1 = true
      const m2 = mockTaskRaw({ id: 't2', text1: 'bar', bool2: true, order: 2 })

      await adapter.batch([
        ['create', 'tasks', m3],
        ['create', 'tasks', m4],
        ['destroyPermanently', 'tasks', m3.id],
        ['update', 'tasks', m1],
        ['create', 'tasks', m2],
        ['markAsDeleted', 'tasks', m4.id],
      ])

      adapter = await adapter.testClone()
      const fetched1 = await adapter.find('tasks', 't1')
      expect(fetched1.bool1).toBe(true)
      expect(fetched1).toEqual(m1)

      const fetched2 = await adapter.find('tasks', 't2')
      expect(fetched2.bool2).toBe(true)

      expect(await adapter.find('tasks', 't3')).toBeNull()
      expect(await adapter.query(taskQuery())).toEqual(['t1', 't2'])

      expect(await adapter.getDeletedRecords('tasks')).toEqual(['t4'])
    },
  ],
  [
    'batches are transactional',
    async (adapter, AdapterClass) => {
      // sanity check
      await adapter.batch([['create', 'tasks', mockTaskRaw({ id: 't1' })]])
      expect(await adapter.query(taskQuery())).toEqual(['t1'])

      await expect(
        adapter.batch([
          ['create', 'tasks', mockTaskRaw({ id: 't2' })],
          ['create', 'does_not_exist', mockTaskRaw({ id: 't3' })],
        ]),
      ).rejects.toMatchObject({
        // TODO: Get rid of the unknown error - fix on Android
        message: expect.stringMatching(
          AdapterClass.name === 'SQLiteAdapter'
            ? /(no such table: does_not_exist|Exception in HostFunction: <unknown>)/
            : /Cannot read property 'insert' of null/,
        ),
      })
      if (AdapterClass.name !== 'LokiJSAdapter') {
        // Regrettably, Loki is not transactional
        expect(await adapter.query(taskQuery())).toEqual(['t1'])
      }
    },
  ],
  [
    'can run sync-like flow',
    async adapter => {
      const queryAll = () => adapter.query(taskQuery())

      const m1 = mockTaskRaw({ id: 't1', text1: 'bar1', order: 1 })
      const m2 = mockTaskRaw({ id: 't2', text1: 'bar2', order: 2 })
      const m3 = mockTaskRaw({ id: 't3', text1: 'bar3', order: 3 })

      await adapter.batch([
        ['create', 'tasks', m1],
        ['create', 'tasks', m2],
        ['create', 'tasks', m3],
        ['create', 'tasks', mockTaskRaw({ id: 't4', text1: 'bar4' })],
        ['markAsDeleted', 'tasks', m1.id],
        ['markAsDeleted', 'tasks', m3.id],
      ])

      // pull server changes - server wants us to delete some records
      await adapter.batch([
        ['destroyPermanently', 'tasks', m1.id],
        ['destroyPermanently', 'tasks', m2.id],
      ])
      expect(await queryAll()).toHaveLength(1)

      // push local changes
      const toDelete = await adapter.getDeletedRecords('tasks')
      expect(toDelete).toEqual(['t3'])
      await adapter.destroyDeletedRecords('tasks', toDelete)

      expect(await adapter.getDeletedRecords('tasks')).toHaveLength(0)
      expect(await queryAll()).toHaveLength(1)
    },
  ],
  [
    'can unsafely reset database',
    async adapter => {
      await adapter.batch([['create', 'tasks', mockTaskRaw({ id: 't1', text1: 'bar', order: 1 })]])
      await adapter.unsafeResetDatabase()
      await expect(await adapter.count(taskQuery())).toBe(0)

      // check that reset database still works
      await adapter.batch([['create', 'tasks', mockTaskRaw({ id: 't2', text1: 'baz', order: 2 })]])
      expect(await adapter.count(taskQuery())).toBe(1)
    },
  ],
  [
    'queues actions correctly',
    async adapter => {
      function queryable(promise) {
        let isSettled = false
        const result = promise.then(
          value => {
            isSettled = true
            return value
          },
          e => {
            isSettled = true
            throw e
          },
        )
        result.isSettled = () => isSettled
        return result
      }

      adapter.batch([['create', 'tasks', mockTaskRaw({ id: 't1', text1: 'foo', order: 1 })]])
      const find1Promise = queryable(adapter.find('tasks', 't1'))
      const find2Promise = queryable(adapter.find('tasks', 't2'))
      adapter.batch([['create', 'tasks', mockTaskRaw({ id: 't2', text1: 'bar', order: 2 })]])
      const queryPromise = queryable(adapter.query(taskQuery()))
      const find2Promise2 = queryable(adapter.find('tasks', 't2'))

      await find2Promise2

      expect(find1Promise.isSettled()).toBe(true)
      expect(find2Promise.isSettled()).toBe(true)
      expect(queryPromise.isSettled()).toBe(true)
      expect(find2Promise2.isSettled()).toBe(true)
      expect(await find1Promise).toBe('t1')
      expect(await find2Promise).toBe(null)
      expect(await queryPromise).toEqual(['t1', 't2'])
      expect(await find2Promise2).toBe('t2')

      // unsafeResetDatabase is the only action in loki that's necessarily asynchronous even in sync mode
      const batchPromise = queryable(
        adapter.batch([['create', 'tasks', mockTaskRaw({ id: 't3', text1: 'bar', order: 2 })]]),
      )
      adapter.unsafeResetDatabase()
      adapter.batch([['create', 'tasks', mockTaskRaw({ id: 't1', text1: 'bar', order: 2 })]])
      const queryPromise2 = adapter.query(taskQuery())

      expect(await queryPromise2).toEqual(['t1'])
      expect(batchPromise.isSettled()).toBe(true)
    },
  ],
  [
    'fails on bad queries, creates, updates, deletes',
    async adapter => {
      const badQuery = new Query({ modelClass: BadModel }, []).serialize()
      await expect(adapter.query(badQuery)).rejects.toBeInstanceOf(Error)
      await expect(adapter.count(badQuery)).rejects.toBeInstanceOf(Error)

      const record1 = new BadModel({ table: 'nonexisting' }, { id: 't1' })
      await expect(adapter.batch([['create', record1]])).rejects.toBeInstanceOf(Error)

      await expect(adapter.batch(['create', record1])).rejects.toBeInstanceOf(Error)

      // TODO: Fix slight inconsistencies between loki & sqlite
      // if (platform.isWeb) {
      // await expect(
      //   adapter.batch([['update', 'tasks', mockTaskRaw({ id: 'nonexists' })]]),
      // ).rejects.toBeInstanceOf(Error)

      // TODO: Mark as deleted?

      // const record = 'tasks', mockTaskRaw({ id: '1' })
      // await expect(adapter.batch([['destroyPermanently', record]])).rejects.toBeInstanceOf(Error)
      // }
    },
  ],
  [
    'does not fail on (weirdly named) table named that are SQLite keywords',
    async adapter => {
      await Promise.all(
        ['where', 'values', 'set', 'drop', 'update'].map(async tableName => {
          await adapter.batch([['create', tableName, { id: 'i1' }]])
          await adapter.batch([['update', tableName, { id: 'i1' }]])
          await adapter.batch([['markAsDeleted', tableName, 'i1']])
          await adapter.batch([['create', tableName, { id: 'i2' }]])
          await adapter.find(tableName, 'i2')
          await adapter.batch([['destroyPermanently', tableName, 'i2']])
        }),
      )
    },
  ],
  [
    'supports LocalStorage',
    async adapter => {
      // non-existent fields return undefined
      expect(await adapter.getLocal('nonexisting')).toBeNull()

      // set
      await adapter.setLocal('test1', 'val1')
      expect(await adapter.getLocal('test1')).toBe('val1')

      // update
      await adapter.setLocal('test1', 'val2')
      expect(await adapter.getLocal('test1')).toBe('val2')

      // delete
      await adapter.removeLocal('test1')
      expect(await adapter.getLocal('test1')).toBeNull()

      // can be safely reassigned
      await adapter.setLocal('test1', 'val3')
      expect(await adapter.getLocal('test1')).toBe('val3')

      // can use keywords as keys
      // can be safely reassigned
      await adapter.setLocal('order', '3')
      expect(await adapter.getLocal('order')).toBe('3')

      // deleting already undefined is safe
      await adapter.removeLocal('nonexisting')
    },
  ],
  [
    'migrates database between versions',
    async (_adapter, AdapterClass, extraAdapterOptions) => {
      // launch app in one version
      const taskColumnsV3 = [{ name: 'num1', type: 'number' }]
      const projectColumnsV3 = [{ name: 'text1', type: 'string' }]
      const testSchemaV3 = appSchema({
        version: 3,
        tables: [
          tableSchema({ name: 'tasks', columns: taskColumnsV3 }),
          tableSchema({ name: 'projects', columns: projectColumnsV3 }),
        ],
      })

      let adapter = new DatabaseAdapterCompat(
        new AdapterClass({
          schema: testSchemaV3,
          migrations: schemaMigrations({ migrations: [{ toVersion: 3, steps: [] }] }),
          ...extraAdapterOptions,
        }),
      )
      // TODO: Remove me. Temporary workaround for the race condition - wait until next macrotask to ensure that database has set up
      await new Promise(resolve => setTimeout(resolve, 0))
      // add data
      await adapter.batch([
        ['create', 'tasks', { id: 't1', num1: 10 }],
        ['create', 'tasks', { id: 't2', num1: 20 }],
      ])

      // can't add to tables that don't exist yet
      await expect(
        adapter.batch([['create', 'tag_assignments', { id: 'tt1', text1: 'hello' }]]),
      ).rejects.toBeInstanceOf(Error)

      // migrate to new version
      const taskColumnsV5 = [
        { name: 'test_string', type: 'string' },
        { name: 'test_string_optional', type: 'string', isOptional: true },
        { name: 'test_number', type: 'number' },
        { name: 'test_number_optional', type: 'number', isOptional: true },
        { name: 'test_boolean', type: 'boolean' },
        { name: 'test_boolean_optional', type: 'boolean', isOptional: true },
      ]
      const projectColumnsV5 = [{ name: 'text2', type: 'string', isIndexed: true }]
      const tagAssignmentSchema = {
        name: 'tag_assignments',
        columns: [{ name: 'text1', type: 'string' }],
      }

      const testSchemaV5 = appSchema({
        version: 5,
        tables: [
          tableSchema({
            name: 'tasks',
            columns: [...taskColumnsV3, ...taskColumnsV5],
          }),
          tableSchema({
            name: 'projects',
            columns: [...projectColumnsV3, ...projectColumnsV5],
          }),
          tableSchema(tagAssignmentSchema),
        ],
      })
      const migrationsV5 = schemaMigrations({
        migrations: [
          {
            toVersion: 5,
            steps: [addColumns({ table: 'tasks', columns: taskColumnsV5 })],
          },
          {
            toVersion: 4,
            steps: [
              createTable(tagAssignmentSchema),
              addColumns({ table: 'projects', columns: projectColumnsV5 }),
            ],
          },
          {
            toVersion: 3,
            steps: [
              createTable({
                name: 'will_not_be_created',
                columns: [{ name: 'num1', type: 'number' }],
              }),
            ],
          },
        ],
      })
      adapter = await adapter.testClone({
        schema: testSchemaV5,
        migrations: migrationsV5,
      })

      // check that the data is still there
      expect(await adapter.count(new Query({ modelClass: MockTask }, []))).toBe(2)

      // check if new columns were populated with appropriate default values
      const checkTaskColumn = (columnName, expectedValue) =>
        new Query({ modelClass: MockTask }, [Q.where(columnName, expectedValue)]).serialize()

      expect(await adapter.count(checkTaskColumn('test_string', ''))).toBe(2)
      expect(await adapter.count(checkTaskColumn('test_string_optional', null))).toBe(2)
      expect(await adapter.count(checkTaskColumn('test_number', 0))).toBe(2)
      expect(await adapter.count(checkTaskColumn('test_number_optional', null))).toBe(2)
      expect(await adapter.count(checkTaskColumn('test_boolean', false))).toBe(2)
      expect(await adapter.count(checkTaskColumn('test_boolean_optional', null))).toBe(2)

      // check I can use new table and columns
      await adapter.batch([
        ['create', 'tag_assignments', { id: 'tt2', text1: 'hello' }],
        ['create', 'projects', { id: 'p1', text1: 'hey', text2: 'foo' }],
        [
          'create',
          'tasks',
          { id: 't3', test_string: 'hey', test_number: 2, test_boolean_optional: true },
        ],
      ])

      // check that out-of-range migration was not executed
      await expect(
        adapter.batch([['create', 'will_not_be_created', { id: 'w1', text1: 'hello' }]]),
      ).rejects.toBeInstanceOf(Error)

      // make sure new fields actually work and that migrations won't be applied again
      adapter = await adapter.testClone()

      const p1 = await adapter.find('projects', 'p1')
      expect(p1.text2).toBe('foo')

      const t1 = await adapter.find('tasks', 't3')
      expect(t1.test_string).toBe('hey')
      expect(t1.test_number).toBe(2)
      expect(t1.test_boolean).toBe(false)

      const tt1 = await adapter.find('tag_assignments', 'tt2')
      expect(tt1.text1).toBe('hello')
    },
  ],
  [
    `can perform empty migrations (regression test)`,
    async (_adapter, AdapterClass, extraAdapterOptions) => {
      let adapter = new DatabaseAdapterCompat(
        new AdapterClass({
          schema: { ...testSchema, version: 1 },
          migrations: schemaMigrations({ migrations: [] }),
          ...extraAdapterOptions,
        }),
      )
      // TODO: Remove me. Temporary workaround for the race condition - wait until next macrotask to ensure that database has set up
      await new Promise(resolve => setTimeout(resolve, 0))
      await adapter.batch([['create', 'tasks', mockTaskRaw({ id: 't1', text1: 'foo' })]])
      expect(await adapter.count(taskQuery())).toBe(1)

      // Perform an empty migration (no steps, just version bump)
      adapter = await adapter.testClone({
        schema: { ...testSchema, version: 2 },
        migrations: schemaMigrations({ migrations: [{ toVersion: 2, steps: [] }] }),
      })

      // check that migration worked, no data lost
      expect(await adapter.count(taskQuery())).toBe(1)
      expect((await adapter.find('tasks', 't1')).text1).toBe('foo')
    },
  ],
  [
    `resets database when it's newer than app schema`,
    async (_adapter, AdapterClass, extraAdapterOptions) => {
      // launch newer version of the app
      let adapter = new DatabaseAdapterCompat(
        new AdapterClass({
          schema: { ...testSchema, version: 3 },
          migrations: schemaMigrations({ migrations: [{ toVersion: 3, steps: [] }] }),
          ...extraAdapterOptions,
        }),
      )
      // TODO: Remove me. Temporary workaround for the race condition - wait until next macrotask to ensure that database has set up
      await new Promise(resolve => setTimeout(resolve, 0))

      await adapter.batch([['create', 'tasks', mockTaskRaw({})]])
      expect(await adapter.count(taskQuery())).toBe(1)

      // launch older version of the app
      adapter = await adapter.testClone({
        schema: { ...testSchema, version: 1 },
        migrations: schemaMigrations({ migrations: [] }),
      })

      expect(await adapter.count(taskQuery())).toBe(0)
      await adapter.batch([['create', 'tasks', mockTaskRaw({})]])
      expect(await adapter.count(taskQuery())).toBe(1)
    },
  ],
  [
    'resets database when there are no available migrations',
    async (_adapter, AdapterClass, extraAdapterOptions) => {
      // launch older version of the app
      let adapter = new DatabaseAdapterCompat(
        new AdapterClass({
          schema: { ...testSchema, version: 1 },
          migrations: schemaMigrations({ migrations: [] }),
          ...extraAdapterOptions,
        }),
      )
      // TODO: Remove me. Temporary workaround for the race condition - wait until next macrotask to ensure that database has set up
      await new Promise(resolve => setTimeout(resolve, 0))

      await adapter.batch([['create', 'tasks', mockTaskRaw({})]])
      expect(await adapter.count(taskQuery())).toBe(1)

      // launch newer version of the app, without migrations available
      adapter = await adapter.testClone({
        schema: { ...testSchema, version: 3 },
        migrations: schemaMigrations({ migrations: [{ toVersion: 3, steps: [] }] }),
      })

      expect(await adapter.count(taskQuery())).toBe(0)
      await adapter.batch([['create', 'tasks', mockTaskRaw({})]])
      expect(await adapter.count(taskQuery())).toBe(1)
    },
  ],
  [
    'errors when migration fails',
    async (_adapter, AdapterClass, extraAdapterOptions) => {
      // launch older version of the app
      let adapter = new DatabaseAdapterCompat(
        new AdapterClass({
          schema: { ...testSchema, version: 1 },
          migrations: schemaMigrations({ migrations: [] }),
          ...extraAdapterOptions,
        }),
      )
      // TODO: Remove me. Temporary workaround for the race condition - wait until next macrotask to ensure that database has set up
      await new Promise(resolve => setTimeout(resolve, 0))

      await adapter.batch([['create', 'tasks', mockTaskRaw({})]])
      expect(await adapter.count(taskQuery())).toBe(1)
      // launch newer version of the app with a migration that will fail
      const adapterPromise = adapter.testClone({
        schema: { ...testSchema, version: 2 },
        migrations: schemaMigrations({
          migrations: [
            {
              toVersion: 2,
              steps: [
                // with SQLite, trying to create a duplicate table will fail, but Loki will just ignore it
                // so let's insert something that WILL fail
                AdapterClass.name === 'LokiJSAdapter'
                  ? { type: 'bad_type' }
                  : createTable({ name: 'tasks', columns: [] }),
              ],
            },
          ],
        }),
      })

      // TODO: Make the SQLite, LokiJS adapter behavior consistent
      if (AdapterClass.name === 'LokiJSAdapter') {
        adapter = await adapterPromise
        await expect(adapter.count(taskQuery())).rejects.toBeInstanceOf(Error)
        await expect(adapter.batch([['create', 'tasks', mockTaskRaw({})]])).rejects.toBeInstanceOf(
          Error,
        )
      } else {
        await expect(adapterPromise).rejects.toBeInstanceOf(Error)
      }
    },
  ],
  ...matchTests.map(testCase => [
    `[shared match test] ${testCase.name}`,
    async adapter => {
      await performMatchTest(adapter, testCase)
    },
  ]),
  [
    '[shared match test] can match strings from big-list-of-naughty-strings',
    async (adapter, AdapterClass, extraAdapterOptions) => {
      // eslint-disable-next-line no-restricted-syntax
      for (const testCase of naughtyMatchTests) {
        // console.log(testCase.name)

        // KNOWN ISSUE: non-JSI adapter implementation gets confused by this (it's a BOM mark)
        if (
          AdapterClass.name === 'SQLiteAdapter' &&
          !extraAdapterOptions.experimentalUseJSI &&
          testCase.matching[0].text1 === '﻿'
        ) {
          // eslint-disable-next-line no-console
          console.warn('skip check for a BOM naughty string - known failing test')
        } else {
          // eslint-disable-next-line no-await-in-loop
          await performMatchTest(adapter, testCase)
        }
      }
    },
  ],
  [
    'can store and retrieve large numbers (regression test)',
    async _adapter => {
      // NOTE: matcher test didn't catch it because both insert and query has the same bug
      let adapter = _adapter
      const number = 1590485104033
      await adapter.batch([['create', 'tasks', { id: 'm1', num1: number }]])
      // launch app again
      adapter = await adapter.testClone()
      const record = await adapter.find('tasks', 'm1')
      expect(record.num1).toBe(number)
    },
  ],
  [
    'can store and retrieve naughty strings exactly',
    async (_adapter, AdapterClass, extraAdapterOptions) => {
      let adapter = _adapter
      const indexedNaughtyStrings = naughtyStrings.map((string, i) => [`id${i}`, string])
      await adapter.batch(
        indexedNaughtyStrings.map(([id, string]) => ['create', 'tasks', { id, text1: string }]),
      )

      // launch app again
      adapter = await adapter.testClone()
      const allRecords = await adapter.query(taskQuery())

      indexedNaughtyStrings.forEach(([id, string]) => {
        const record = allRecords.find(model => model.id === id)
        // console.log(string, record)
        // KNOWN ISSUE: non-JSI adapter implementation gets confused by this (it's a BOM mark)
        if (
          AdapterClass.name === 'SQLiteAdapter' &&
          !extraAdapterOptions.experimentalUseJSI &&
          string === '﻿'
        ) {
          expect(record.text1).not.toBe(string) // if this fails, it means the issue's been fixed
        } else {
          expect(!!record).toBe(true)
          expect(record.text1).toBe(string)
        }
      })
    },
  ],
  ...joinTests.map(testCase => [
    `[shared join test] ${testCase.name}`,
    async adapter => {
      await performJoinTest(adapter, testCase)
    },
  ]),
]
