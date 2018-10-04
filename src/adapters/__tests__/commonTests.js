import expect from 'expect'

import Model from '../../Model'
import Query from '../../Query'
import { sanitizedRaw } from '../../RawRecord'
import * as Q from '../../QueryDescription'
import { schemaMigrations } from '../../Schema/migrations'
// import { platform } from 'utils/common'

import { matchTests, joinTests } from '../../__tests__/databaseTests'
import {
  testSchema,
  taskQuery,
  makeMockTask,
  performMatchTest,
  performJoinTest,
  expectSortedEqual,
  MockTask,
  MockTagAssignment,
} from './helpers'

class BadModel extends Model {
  static table = 'nonexistent'
}

export default () => [
  [
    'validates adapter options',
    (_adapter, AdapterClass) => async () => {
      const schema = { ...testSchema, version: 10 }

      const makeAdapter = options => new AdapterClass({ isTest: true, schema, ...options })
      const adapterWithMigrations = migrations =>
        makeAdapter({ migrationsExperimental: migrations })

      // expect(() => makeAdapter({})).toThrowError(/missing migrations/)

      expect(() =>
        adapterWithMigrations({ minimumVersion: 10, currentVersion: 10, migrations: [] }),
      ).toThrowError(/use schemaMigrations()/)

      expect(() =>
        adapterWithMigrations(
          schemaMigrations({
            minimumVersion: 10,
            currentVersion: 10,
            migrations: [],
          }),
        ),
      ).not.toThrowError()

      expect(() =>
        adapterWithMigrations(
          schemaMigrations({
            minimumVersion: 8,
            currentVersion: 8,
            migrations: [],
          }),
        ),
      ).toThrowError(/Missing migration/)

      expect(() =>
        adapterWithMigrations(
          schemaMigrations({
            minimumVersion: 12,
            currentVersion: 12,
            migrations: [],
          }),
        ),
      ).toThrowError(/don't match schema/)
    },
  ],
  [
    'can query and count on empty db',
    adapter => async () => {
      const query = taskQuery()
      expect(await adapter.query(query)).toEqual([])
      expect(await adapter.count(query)).toBe(0)
    },
  ],
  [
    'can create and find records (sanity test)',
    adapter => async () => {
      const record = makeMockTask({ id: 'abc', text1: 'bar', order: 1 })
      await adapter.batch([['create', record]])
      expect(await adapter.find('tasks', 'abc')).toBe('abc')
    },
  ],
  [
    'can find records by ID',
    _adapter => async () => {
      let adapter = _adapter

      // add a record
      const s1 = makeMockTask({ id: 's1', text1: 'bar', order: 1 })
      await adapter.batch([['create', s1]])

      // returns cached ID after create
      expect(await adapter.find('tasks', 's1')).toBe('s1')

      // add more, restart app
      const s2 = makeMockTask({ id: 's2', bool1: true, order: 2 })
      const s3 = makeMockTask({ id: 's3', text1: 'baz' })
      await adapter.batch([['create', s2], ['create', s3]])
      adapter = adapter.testClone()

      // returns raw if not cached
      expect(await adapter.find('tasks', 's2')).toEqual(s2._raw)
      expect(await adapter.find('tasks', 's3')).toEqual(s3._raw)

      // caches records after first find
      expect(await adapter.find('tasks', 's2')).toBe('s2')

      // returns null if not found
      expect(await adapter.find('tasks', 's4')).toBe(null)
    },
  ],
  [
    'sanitizes records on find',
    _adapter => async () => {
      let adapter = _adapter
      const tt1 = new MockTagAssignment(
        { table: 'tag_assignments' },
        { id: 'tt1', task_id: 'abcdef' }, // Unsanitized raw!
      )
      expect(tt1._raw._status).toBeUndefined()

      await adapter.batch([['create', tt1]])
      adapter = adapter.testClone()

      expect(await adapter.find('tag_assignments', 'tt1')).toEqual(
        sanitizedRaw(tt1._raw, testSchema.tables.tag_assignments),
      )
    },
  ],
  [
    'can query and count records',
    adapter => async () => {
      const record1 = makeMockTask({ id: 't1', text1: 'bar', bool1: false, order: 1 })
      const record2 = makeMockTask({ id: 't2', text1: 'baz', bool1: true, order: 2 })
      const record3 = makeMockTask({ id: 't3', text1: 'abc', bool1: false, order: 3 })

      await adapter.batch([['create', record1], ['create', record2], ['create', record3]])

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
    'compacts query results',
    _adapter => async () => {
      let adapter = _adapter
      const queryAll = () => adapter.query(taskQuery())

      // add records, restart app
      const s1 = makeMockTask({ id: 's1', order: 1 })
      const s2 = makeMockTask({ id: 's2', order: 2 })
      await adapter.batch([['create', s1], ['create', s2]])
      adapter = adapter.testClone()

      // first time we see it, get full object
      expectSortedEqual(await queryAll(), [s1._raw, s2._raw])

      // cached next time
      expect(await queryAll()).toEqual(['s1', 's2'])

      // updating doesn't change anything
      await adapter.batch([['update', s2]])
      expect(await queryAll()).toEqual(['s1', 's2'])

      // records added via adapter get cached automatically
      const s3 = makeMockTask({ id: 's3' })
      await adapter.batch([['create', s3]])
      expect(await queryAll()).toEqual(['s1', 's2', 's3'])

      // remove and re-add and it appears again
      await adapter.batch([['destroyPermanently', s3]])
      expect(await queryAll()).toEqual(['s1', 's2'])

      const s3New = makeMockTask({ id: 's3', bool1: true })
      await adapter.batch([['create', s3New]])
      expect(await queryAll()).toEqual(['s1', 's2', 's3'])

      // restart app, doesn't have the records
      adapter = adapter.testClone()
      expectSortedEqual(await queryAll(), [s1._raw, s2._raw, s3New._raw])
    },
  ],
  [
    'sanitizes records on query',
    _adapter => async () => {
      let adapter = _adapter
      // Unsanitized raw!
      const t1 = new MockTask({ table: 'tasks' }, { id: 't1', text1: 'foo', order: 1 })
      const t2 = new MockTask({ table: 'tasks' }, { id: 't2', text2: 'bar', order: 2 })
      expect(t1._raw._status).toBeUndefined()
      expect(t2._raw._status).toBeUndefined()

      await adapter.batch([['create', t1], ['create', t2]])
      adapter = adapter.testClone()

      expectSortedEqual(await adapter.query(taskQuery()), [
        sanitizedRaw(t1._raw, testSchema.tables.tasks),
        sanitizedRaw(t2._raw, testSchema.tables.tasks),
      ])
    },
  ],
  [
    'returns a COPY of the data',
    _adapter => async () => {
      let adapter = _adapter
      const record = makeMockTask({ id: 't1', text1: 'bar' })
      const originalRaw = { ...record._raw }
      await adapter.batch([['create', record]])

      adapter = adapter.testClone()
      const fetchedRaw = await adapter.find('tasks', 't1')

      // data is equal but not the same reference
      expect(fetchedRaw).toEqual(originalRaw)
      expect(fetchedRaw).toEqual(record._raw)
      expect(fetchedRaw).not.toBe(record._raw)

      // make sure same is true for query
      adapter = adapter.testClone()
      const [queriedRaw] = await adapter.query(taskQuery())
      expect(queriedRaw).toEqual(originalRaw)
      expect(queriedRaw).not.toBe(record._raw)
    },
  ],
  [
    'can update records',
    _adapter => async () => {
      let adapter = _adapter
      const record = makeMockTask({ id: 't1', text1: 'bar' })
      await adapter.batch([['create', record]])
      record._isEditing = true
      record._setRaw('bool1', true)
      record._setRaw('order', 2)
      await adapter.batch([['update', record]])

      adapter = adapter.testClone()
      const fetchedUpdatedRaw = await adapter.find('tasks', 't1')

      // check raws are equal (but a copy)
      expect(fetchedUpdatedRaw.bool1).toBe(true)
      expect(fetchedUpdatedRaw.order).toBe(2)
      expect(fetchedUpdatedRaw).toEqual(record._raw)
      expect(fetchedUpdatedRaw).not.toBe(record._raw)
    },
  ],
  [
    'can mark records as deleted',
    adapter => async () => {
      const m1 = makeMockTask({ id: 't1', text1: 'bar1' })
      await adapter.batch([['create', m1]])
      expect(await adapter.query(taskQuery())).toEqual(['t1'])

      await adapter.batch([['markAsDeleted', m1]])
      expect(await adapter.query(taskQuery())).toEqual([])

      // Check that the record is removed from cache
      // HACK: Set _status to reveal the record in query (if record was cached, there would only be ID)
      m1._status = 'synced'
      await adapter.batch([['update', m1]])
      expectSortedEqual(await adapter.query(taskQuery()), [m1._raw])
    },
  ],
  [
    'can get deleted record ids',
    adapter => async () => {
      const m1 = makeMockTask({ id: 't1', text1: 'bar1', order: 1 })
      const m2 = makeMockTask({ id: 't2', text1: 'bar2', order: 2 })
      await adapter.batch([
        ['create', m1],
        ['markAsDeleted', m1],
        ['create', m2],
        ['create', makeMockTask({ id: 't3', text1: 'bar3' })],
        ['markAsDeleted', m2],
      ])
      expectSortedEqual(await adapter.getDeletedRecords('tasks'), ['t2', 't1'])
    },
  ],
  [
    'can destroy deleted records',
    adapter => async () => {
      const m1 = makeMockTask({ id: 't1', text1: 'bar1', order: 1 })
      const m2 = makeMockTask({ id: 't2', text1: 'bar2', order: 2 })
      const m3 = makeMockTask({ id: 't3', text1: 'bar3', order: 3 })
      await adapter.batch([
        ['create', m1],
        ['create', m2],
        ['create', m3],
        ['create', makeMockTask({ id: 't4', text1: 'bar4' })],
      ])
      await adapter.batch([['markAsDeleted', m1], ['markAsDeleted', m2], ['markAsDeleted', m3]])

      await adapter.destroyDeletedRecords('tasks', ['t1', 't2'])
      expectSortedEqual(await adapter.getDeletedRecords('tasks'), ['t3'])
      expectSortedEqual(await adapter.query(taskQuery()), ['t4'])
      expect(await adapter.find('tasks', 't1')).toBeNull()
      expect(await adapter.find('tasks', 't2')).toBeNull()
    },
  ],
  [
    'can run mixed batches',
    _adapter => async () => {
      let adapter = _adapter
      const m1 = makeMockTask({ id: 't1', text1: 'bar' })
      const m3 = makeMockTask({ id: 't3' })
      const m4 = makeMockTask({ id: 't4' })

      await adapter.batch([['create', m1]])

      m1._isEditing = true
      m1._setRaw('bool1', true)
      const m2 = makeMockTask({ id: 't2', text1: 'bar', bool2: true, order: 2 })

      await adapter.batch([
        ['create', m3],
        ['create', m4],
        ['destroyPermanently', m3],
        ['update', m1],
        ['create', m2],
        ['markAsDeleted', m4],
      ])

      adapter = adapter.testClone()
      const fetched1 = await adapter.find('tasks', 't1')
      expect(fetched1.bool1).toBe(true)
      expect(fetched1).toEqual(m1._raw)

      const fetched2 = await adapter.find('tasks', 't2')
      expect(fetched2.bool2).toBe(true)

      expect(await adapter.find('tasks', 't3')).toBeNull()
      expect(await adapter.query(taskQuery())).toEqual(['t1', 't2'])

      expect(await adapter.getDeletedRecords('tasks')).toEqual(['t4'])
    },
  ],
  [
    'can run sync-like flow',
    adapter => async () => {
      const queryAll = () => adapter.query(taskQuery())

      const m1 = makeMockTask({ id: 't1', text1: 'bar1', order: 1 })
      const m2 = makeMockTask({ id: 't2', text1: 'bar2', order: 2 })
      const m3 = makeMockTask({ id: 't3', text1: 'bar3', order: 3 })

      await adapter.batch([
        ['create', m1],
        ['create', m2],
        ['create', m3],
        ['create', makeMockTask({ id: 't4', text1: 'bar4' })],
        ['markAsDeleted', m1],
        ['markAsDeleted', m3],
      ])

      // pull server changes - server wants us to delete some records
      await adapter.batch([['destroyPermanently', m1], ['destroyPermanently', m2]])
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
    adapter => async () => {
      await adapter.batch([['create', makeMockTask({ id: 't1', text1: 'bar', order: 1 })]])
      await adapter.unsafeResetDatabase()
      await expect(await adapter.count(taskQuery())).toBe(0)

      // check that reset database still works
      await adapter.batch([['create', makeMockTask({ id: 't2', text1: 'baz', order: 2 })]])
      expect(await adapter.count(taskQuery())).toBe(1)
    },
  ],
  [
    'fails on bad queries, creates, updates, deletes',
    adapter => async () => {
      const badQuery = new Query({ modelClass: BadModel }, [])
      await expect(adapter.query(badQuery)).rejects.toBeInstanceOf(Error)
      await expect(adapter.count(badQuery)).rejects.toBeInstanceOf(Error)

      const record1 = new BadModel({ table: 'nonexisting' }, { id: 't1' })
      await expect(adapter.batch([['create', record1]])).rejects.toBeInstanceOf(Error)

      await expect(adapter.batch(['create', record1])).rejects.toBeInstanceOf(Error)

      // TODO: Fix slight inconsistencies between loki & sqlite
      // if (platform.isWeb) {
      // await expect(
      //   adapter.batch([['update', makeMockTask({ id: 'nonexists' })]]),
      // ).rejects.toBeInstanceOf(Error)

      // TODO: Mark as deleted?

      // const record = makeMockTask({ id: '1' })
      // await expect(adapter.batch([['destroyPermanently', record]])).rejects.toBeInstanceOf(Error)
      // }
    },
  ],
  [
    'supports LocalStorage',
    adapter => async () => {
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
  ...matchTests.map(testCase => [
    `[shared match test] ${testCase.name}`,
    adapter => async () => {
      await performMatchTest(adapter, testCase)
    },
  ]),
  ...joinTests.map(testCase => [
    `[shared join test] ${testCase.name}`,
    adapter => async () => {
      await performJoinTest(adapter, testCase)
    },
  ]),
]
