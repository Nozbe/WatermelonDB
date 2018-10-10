import expect from 'expect'

import Model from '../../Model'
import Query from '../../Query'
import { sanitizedRaw } from '../../RawRecord'
import * as Q from '../../QueryDescription'
import { appSchema, tableSchema } from '../../Schema'
import { schemaMigrations, createTable, addColumns } from '../../Schema/migrations'

import { matchTests, joinTests } from '../../__tests__/databaseTests'
import {
  testSchema,
  taskQuery,
  makeMockTask,
  performMatchTest,
  performJoinTest,
  expectSortedEqual,
  MockTask,
  MockProject,
  MockTagAssignment,
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
      const adapterWithMigrations = migrations =>
        makeAdapter({ migrationsExperimental: migrations })

      // expect(() => makeAdapter({})).toThrowError(/missing migrations/)

      expect(() => adapterWithMigrations({ migrations: [] })).toThrowError(/use schemaMigrations()/)

      expect(() => adapterWithMigrations(schemaMigrations({ migrations: [] }))).not.toThrowError()

      expect(() =>
        adapterWithMigrations(
          schemaMigrations({
            migrations: [{ version: 11, steps: [] }],
          }),
        ),
      ).toThrowError(/don't match schema/)

      expect(() =>
        adapterWithMigrations(
          schemaMigrations({
            migrations: [{ version: 8, steps: [] }, { version: 9, steps: [] }],
          }),
        ),
      ).toThrowError(/no available migrations/)

      expect(() =>
        adapterWithMigrations(
          schemaMigrations({ migrations: [{ version: 9, steps: [] }, { version: 10, steps: [] }] }),
        ),
      ).not.toThrowError()
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
      const record = makeMockTask({ id: 'abc', text1: 'bar', order: 1 })
      await adapter.batch([['create', record]])
      expect(await adapter.find('tasks', 'abc')).toBe('abc')
    },
  ],
  [
    'can find records by ID',
    async _adapter => {
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
    async _adapter => {
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
    async adapter => {
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
    async _adapter => {
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
    async _adapter => {
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
    async _adapter => {
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
    async _adapter => {
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
    async adapter => {
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
    async adapter => {
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
    async adapter => {
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
    async _adapter => {
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
    async adapter => {
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
    async adapter => {
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
    async adapter => {
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
    async (_adapter, AdapterClass) => {
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

      let adapter = new AdapterClass({
        schema: testSchemaV3,
        migrationsExperimental: schemaMigrations({ migrations: [] }),
      })

      // add data
      await adapter.batch([
        ['create', new MockTask({}, { id: 't1', num1: 10 })],
        ['create', new MockTask({}, { id: 't2', num1: 20 })],
      ])

      // can't add to tables that don't exist yet
      await expect(
        adapter.batch([['create', new MockTagAssignment({}, { id: 'tt1', text1: 'hello' })]]),
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
          tagAssignmentSchema,
        ],
      })
      const migrationsV5 = schemaMigrations({
        migrations: [
          {
            version: 5,
            steps: [addColumns({ table: 'tasks', columns: taskColumnsV5 })],
          },
          {
            version: 4,
            steps: [
              createTable(tagAssignmentSchema),
              addColumns({ table: 'projects', columns: projectColumnsV5 }),
            ],
          },
          {
            versions: 3,
            steps: [
              createTable({
                name: 'will_not_be_created',
                columns: [{ name: 'num1', type: 'number' }],
              }),
            ],
          },
        ],
      })
      adapter = adapter.testClone({
        schema: testSchemaV5,
        migrationsExperimental: migrationsV5,
      })

      // check that the data is still there
      expect(await adapter.count(new Query({ modelClass: MockTask }, []))).toBe(2)

      // check if new columns were populated with appropriate default values
      const checkTaskColumn = (columnName, expectedValue) =>
        new Query({ modelClass: MockTask }, [Q.where(columnName, expectedValue)])

      expect(await adapter.count(checkTaskColumn('test_string', ''))).toBe(2)
      expect(await adapter.count(checkTaskColumn('test_string_optional', null))).toBe(2)
      expect(await adapter.count(checkTaskColumn('test_number', 0))).toBe(2)
      expect(await adapter.count(checkTaskColumn('test_number_optional', null))).toBe(2)
      expect(await adapter.count(checkTaskColumn('test_boolean', false))).toBe(2)
      expect(await adapter.count(checkTaskColumn('test_boolean_optional', null))).toBe(2)

      // check I can use new table and columns
      adapter.batch([
        ['create', new MockTagAssignment({}, { id: 'tt2', text1: 'hello' })],
        ['create', new MockProject({}, { id: 'p1', text1: 'hey', text2: 'foo' })],
        [
          'create',
          new MockTask(
            {},
            { id: 't3', test_string: 'hey', test_number: 2, test_boolean_optional: true },
          ),
        ],
      ])

      // check that out-of-range migration was not executed
      class WillNotBeCreated extends Model {
        static table = 'will_not_be_created'
      }
      await expect(
        adapter.batch([['create', new WillNotBeCreated({}, { id: 'w1', text1: 'hello' })]]),
      ).rejects.toBeInstanceOf(Error)

      // make sure new fields actually work and that migrations won't be applied again
      adapter = adapter.testClone()

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
  ...matchTests.map(testCase => [
    `[shared match test] ${testCase.name}`,
    async adapter => {
      await performMatchTest(adapter, testCase)
    },
  ]),
  ...joinTests.map(testCase => [
    `[shared join test] ${testCase.name}`,
    async adapter => {
      await performJoinTest(adapter, testCase)
    },
  ]),
]
