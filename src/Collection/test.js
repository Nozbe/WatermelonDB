import Query from '../Query'
import * as Q from '../QueryDescription'
import { logger } from '../utils/common'
import { CollectionChangeTypes } from '../Collection'

import { mockDatabase, MockTask, testSchema } from '../__tests__/testModels'

const mockQuery = collection => new Query(collection, [Q.where('a', 'b')])

describe('watermelondb/Collection', () => {
  it('find: finds records in cache if available', async () => {
    const { tasksCollection: collection } = mockDatabase()

    const m1 = new MockTask(collection, { id: 'm1' })
    collection._cache.add(m1)

    expect(await collection.find('m1')).toBe(m1)

    const m2 = new MockTask(collection, { id: 'm2' })
    collection._cache.add(m2)

    expect(await collection.find('m1')).toBe(m1)
    expect(await collection.find('m2')).toBe(m2)
  })
  it('find: finds records in database if not in cache', async () => {
    const { tasksCollection: collection, adapter } = mockDatabase()

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
  it('find: rejects promise if record cannot be found', async () => {
    const { tasksCollection: collection, adapter } = mockDatabase()

    adapter.find = jest.fn().mockReturnValue(null)

    await expect(collection.find('m1')).rejects.toBeInstanceOf(Error)
    await expect(collection.find('m1')).rejects.toBeInstanceOf(Error)

    expect(adapter.find.mock.calls.length).toBe(2)
  })
  it('fetchQuery: fetches queries and caches records', async () => {
    const { tasksCollection: collection, adapter } = mockDatabase()

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
    expect(adapter.query.mock.calls[0][0]).toBe(query)
  })
  it('fetchQuery: fetches query records from cache if possible', async () => {
    const { tasksCollection: collection, adapter } = mockDatabase()

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
  it('fetchQuery: fetches query records from cache even if full raw object was sent', async () => {
    const { tasksCollection: collection, adapter } = mockDatabase()

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
  it('fetchCount: fetches counts', async () => {
    const { tasksCollection: collection, adapter } = mockDatabase()

    adapter.count = jest
      .fn()
      .mockReturnValueOnce(5)
      .mockReturnValueOnce(10)

    const query = mockQuery(collection)

    expect(await collection.fetchCount(query)).toBe(5)
    expect(await collection.fetchCount(query)).toBe(10)

    expect(adapter.count.mock.calls.length).toBe(2)
    expect(adapter.count.mock.calls[0][0]).toBe(query)
    expect(adapter.count.mock.calls[1][0]).toBe(query)
  })
  it('can create records', async () => {
    const { tasksCollection: collection, adapter } = mockDatabase()
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
    expect(dbBatchSpy).toBeCalledWith([['create', m1]])
    expect(observer).toHaveBeenCalledTimes(1)
    expect(observer).toBeCalledWith([{ record: m1, type: CollectionChangeTypes.created }])
    expect(collection._cache.get(m1.id)).toBe(m1)
    expect(await collection.find(m1.id)).toBe(m1)
  })
  it('can prepare records', async () => {
    const { tasksCollection: collection, database } = mockDatabase()
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
  it('can update records', async () => {
    const { tasksCollection: collection, adapter } = mockDatabase()
    adapter.batch = jest.fn()

    const observer = jest.fn()
    collection.changes.subscribe(observer)

    const m1 = new MockTask(collection, { id: 'm1' })
    collection._cache.add(m1)

    await collection._update(m1)

    // Check database update, observers update
    expect(adapter.batch).toHaveBeenCalledTimes(1)
    expect(adapter.batch).toBeCalledWith([['update', m1]])
    expect(observer).toHaveBeenCalledTimes(1)
    expect(observer).toBeCalledWith([{ record: m1, type: CollectionChangeTypes.updated }])
  })
  it('can destroy records permanently', async () => {
    const { tasksCollection: collection, adapter } = mockDatabase()
    adapter.batch = jest.fn()

    const observer = jest.fn()
    collection.changes.subscribe(observer)

    const m1 = new MockTask(collection, { id: 'm1' })
    collection._cache.add(m1)

    await collection._destroyPermanently(m1)

    // Check database delete, cache delete, observers update
    expect(adapter.batch).toHaveBeenCalledTimes(1)
    expect(adapter.batch).toBeCalledWith([['destroyPermanently', m1]])
    expect(collection._cache.get('m1')).toBe(undefined)
    expect(observer).toHaveBeenCalledTimes(1)
    expect(observer).toBeCalledWith([{ record: m1, type: CollectionChangeTypes.destroyed }])
  })
  it('exposes schema', () => {
    const { tasksCollection, projectsCollection } = mockDatabase()

    expect(tasksCollection.schema).toBe(testSchema.tables.mock_tasks)
    expect(tasksCollection.schema.name).toBe('mock_tasks')
    expect(tasksCollection.schema.columns.name).toEqual({ name: 'name', type: 'string' })

    expect(projectsCollection.schema).toBe(testSchema.tables.mock_projects)
  })
})
