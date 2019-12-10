import { expectToRejectWithMessage } from '../__tests__/utils'
import { noop } from '../utils/fp'

import Query from '../Query'
import * as Q from '../QueryDescription'
import { logger } from '../utils/common'
import { mockDatabase, MockTask, testSchema } from '../__tests__/testModels'

import { CollectionChangeTypes } from './common'

const mockQuery = collection => new Query(collection, [Q.where('a', 'b')])

describe('Collection', () => {
  it('exposes schema', () => {
    const { tasks, projects } = mockDatabase()

    expect(tasks.schema).toBe(testSchema.tables.mock_tasks)
    expect(tasks.schema.name).toBe('mock_tasks')
    expect(tasks.schema.columns.name).toEqual({ name: 'name', type: 'string' })

    expect(projects.schema).toBe(testSchema.tables.mock_projects)
  })
})

describe('finding records', () => {
  it('finds records in cache if available', async () => {
    const { tasks: collection } = mockDatabase()

    const m1 = new MockTask(collection, { id: 'm1' })
    collection._cache.add(m1)

    expect(await collection.find('m1')).toBe(m1)

    const m2 = new MockTask(collection, { id: 'm2' })
    collection._cache.add(m2)

    expect(await collection.find('m1')).toBe(m1)
    expect(await collection.find('m2')).toBe(m2)
  })
  it('finds records in database if not in cache', async () => {
    const { tasks: collection, adapter } = mockDatabase()

    // TODO: Don't mock
    // TODO: Should ID (not raw) response be tested?
    adapter.find = jest.fn().mockReturnValueOnce({ id: 'm1' })

    // calls db
    const m1 = await collection.find('m1')
    expect(m1._raw).toEqual({ id: 'm1' })
    expect(m1.id).toBe('m1')
    expect(m1.table).toBe('mock_tasks')
    expect(m1.collection).toBe(collection)

    expect(collection._cache.map.size).toBe(1)

    // check call
    expect(adapter.find.mock.calls[0]).toEqual(['mock_tasks', 'm1'])

    // second find will be from cache
    const m1Cached = await collection.find('m1')
    expect(m1Cached).toBe(m1)

    expect(collection._cache.map.size).toBe(1)
    expect(adapter.find.mock.calls.length).toBe(1)
  })
  it('rejects promise if record cannot be found', async () => {
    const { tasks: collection, adapter } = mockDatabase()

    adapter.find = jest.fn().mockReturnValue(null)

    await expect(collection.find('m1')).rejects.toBeInstanceOf(Error)
    await expect(collection.find('m1')).rejects.toBeInstanceOf(Error)

    expect(adapter.find.mock.calls.length).toBe(2)
  })
})

describe('fetching queries', () => {
  it('fetches queries and caches records', async () => {
    const { tasks: collection, adapter } = mockDatabase()

    adapter.query = jest.fn().mockReturnValueOnce([{ id: 'm1' }, { id: 'm2' }])

    const query = mockQuery(collection)

    // fetch, check models
    const models = await collection.fetchQuery(query)
    expect(models.length).toBe(2)

    expect(models[0]._raw).toEqual({ id: 'm1' })
    expect(models[0].id).toBe('m1')
    expect(models[0].table).toBe('mock_tasks')
    expect(models[1]._raw).toEqual({ id: 'm2' })

    // check if records were cached
    expect(collection._cache.map.size).toBe(2)
    expect(collection._cache.map.get('m1')).toBe(models[0])
    expect(collection._cache.map.get('m2')).toBe(models[1])

    // check if query was passed correctly
    expect(adapter.query.mock.calls.length).toBe(1)
    expect(adapter.query.mock.calls[0][0]).toEqual(query.serialize())
  })
  it('fetches query records from cache if possible', async () => {
    const { tasks: collection, adapter } = mockDatabase()

    adapter.query = jest.fn().mockReturnValueOnce(['m1', { id: 'm2' }])

    const m1 = new MockTask(collection, { id: 'm1' })
    collection._cache.add(m1)

    // fetch, check models
    const models = await collection.fetchQuery(mockQuery(collection))
    expect(models.length).toBe(2)
    expect(models[0]).toBe(m1)
    expect(models[1]._raw).toEqual({ id: 'm2' })

    // check cache
    expect(collection._cache.map.get('m2')).toBe(models[1])
  })
  it('fetches query records from cache even if full raw object was sent', async () => {
    const { tasks: collection, adapter } = mockDatabase()

    adapter.query = jest.fn().mockReturnValueOnce([{ id: 'm1' }, { id: 'm2' }])

    const m1 = new MockTask(collection, { id: 'm1' })
    collection._cache.add(m1)

    // fetch, check if error occured
    const spy = jest.spyOn(logger, 'error').mockImplementation(() => {})
    const models = await collection.fetchQuery(mockQuery(collection))
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()

    // check models
    expect(models.length).toBe(2)
    expect(models[0]).toBe(m1)
    expect(models[1]._raw).toEqual({ id: 'm2' })
  })
  it('fetches counts', async () => {
    const { tasks: collection, adapter } = mockDatabase()

    adapter.count = jest
      .fn()
      .mockReturnValueOnce(5)
      .mockReturnValueOnce(10)

    const query = mockQuery(collection)

    expect(await collection.fetchCount(query)).toBe(5)
    expect(await collection.fetchCount(query)).toBe(10)

    expect(adapter.count.mock.calls.length).toBe(2)
    expect(adapter.count.mock.calls[0][0]).toEqual(query.serialize())
    expect(adapter.count.mock.calls[1][0]).toEqual(query.serialize())
  })
})

describe('creating new records', () => {
  it('can create records', async () => {
    const { tasks: collection, adapter } = mockDatabase()
    const dbBatchSpy = jest.spyOn(adapter, 'batch')

    const observer = jest.fn()
    collection.changes.subscribe(observer)

    // Check Model._prepareCreate was called
    const newModelSpy = jest.spyOn(MockTask, '_prepareCreate')

    const m1 = await collection.create()

    // Check database insert, cache insert, observers update
    expect(m1._isCommitted).toBe(true)
    expect(newModelSpy).toHaveBeenCalledTimes(1)
    expect(dbBatchSpy).toHaveBeenCalledTimes(1)
    expect(dbBatchSpy).toHaveBeenCalledWith([['create', 'mock_tasks', m1._raw]])
    expect(observer).toHaveBeenCalledTimes(1)
    expect(observer).toHaveBeenCalledWith([{ record: m1, type: CollectionChangeTypes.created }])
    expect(collection._cache.get(m1.id)).toBe(m1)
    expect(await collection.find(m1.id)).toBe(m1)
  })
  it('can prepare records', async () => {
    const { tasks: collection, database } = mockDatabase()
    database.adapter = {} // make sure not called

    const observer = jest.fn()
    collection.changes.subscribe(observer)

    const newModelSpy = jest.spyOn(MockTask, '_prepareCreate')

    const m1 = collection.prepareCreate()

    expect(m1._isCommitted).toBe(false)
    expect(newModelSpy).toHaveBeenCalledTimes(1)
    expect(observer).toHaveBeenCalledTimes(0)
    await expect(collection.find(m1.id)).rejects.toBeInstanceOf(Error)
  })
  it('can prepare records from raw', async () => {
    const { tasks: collection } = mockDatabase()

    const newModelSpy = jest.spyOn(MockTask, '_prepareCreateFromDirtyRaw')

    const m1 = collection.prepareCreateFromDirtyRaw({ col3: 'hello' })
    expect(m1._isCommitted).toBe(false)
    expect(newModelSpy).toHaveBeenCalledTimes(1)
  })
  it('disallows record creating outside of an action', async () => {
    const { database, tasks } = mockDatabase({ actionsEnabled: true })

    await expectToRejectWithMessage(
      tasks.create(noop),
      /can only be called from inside of an Action/,
    )

    // no throw inside action
    await database.action(() => tasks.create(noop))
  })
})

describe('Collection observation', () => {
  it('can subscribe to collection changes', async () => {
    const { database, tasks } = mockDatabase({ actionsEnabled: true })

    await database.action(() => tasks.create())

    const subscriber1 = jest.fn()
    const unsubscribe1 = tasks.experimentalSubscribe(subscriber1)

    expect(subscriber1).toHaveBeenCalledTimes(0)

    const t1 = await database.action(() => tasks.create())

    expect(subscriber1).toHaveBeenCalledTimes(1)
    expect(subscriber1).toHaveBeenLastCalledWith([{ record: t1, type: 'created' }])

    const subscriber2 = jest.fn()
    const unsubscribe2 = tasks.experimentalSubscribe(subscriber2)

    await database.action(() => t1.update())

    expect(subscriber1).toHaveBeenCalledTimes(2)
    expect(subscriber2).toHaveBeenCalledTimes(1)
    expect(subscriber2).toHaveBeenLastCalledWith([{ record: t1, type: 'updated' }])

    unsubscribe1()

    await database.action(() => t1.markAsDeleted())

    expect(subscriber1).toHaveBeenCalledTimes(2)
    expect(subscriber2).toHaveBeenCalledTimes(2)
    expect(subscriber2).toHaveBeenLastCalledWith([{ record: t1, type: 'destroyed' }])

    unsubscribe2()

    await database.action(() => tasks.create())
    expect(subscriber2).toHaveBeenCalledTimes(2)
  })
  it('unsubscribe can safely be called more than once', async () => {
    const { database, tasks } = mockDatabase({ actionsEnabled: true })

    const subscriber1 = jest.fn()
    const unsubscribe1 = tasks.experimentalSubscribe(subscriber1)
    expect(subscriber1).toHaveBeenCalledTimes(0)

    const unsubscribe2 = tasks.experimentalSubscribe(() => {})
    unsubscribe2()
    unsubscribe2()

    await database.action(() => tasks.create())
    expect(subscriber1).toHaveBeenCalledTimes(1)

    unsubscribe1()
  })
})
