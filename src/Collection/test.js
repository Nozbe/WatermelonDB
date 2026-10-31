import { filter, take } from 'rxjs/operators'
import { expectToRejectWithMessage } from '../__tests__/utils'
import { noop } from '../utils/fp'

import Query from '../Query'
import * as Q from '../QueryDescription'
import { logger } from '../utils/common'
import { toPromise } from '../utils/fp/Result'

import { mockDatabase, MockTask, testSchema } from '../__tests__/testModels'

const mockQuery = (collection) => new Query(collection, [Q.where('a', 'b')])

describe('Collection', () => {
  it(`exposes database`, () => {
    const { db, projects } = mockDatabase()
    expect(projects.database).toBe(db)
    expect(projects.db).toBe(db)
  })
  it('exposes schema', () => {
    const { tasks, projects } = mockDatabase()

    expect(tasks.schema).toBe(testSchema.tables.mock_tasks)
    expect(tasks.schema.name).toBe('mock_tasks')
    expect(tasks.schema.columns.name).toEqual({ name: 'name', type: 'string' })

    expect(projects.schema).toBe(testSchema.tables.mock_projects)
  })
  it(`exposes query()`, () => {
    const { tasks } = mockDatabase()
    const conditions = [Q.where('a', 'b'), Q.where('c', 'd')]
    const query = tasks.query(...conditions)
    expect(query).toBeInstanceOf(Query)
    expect(query.collection).toBe(tasks)
  })
  it(`query() can accept both a spread and an array`, () => {
    const { tasks } = mockDatabase()
    const conditions = [Q.where('a', 'b'), Q.where('c', 'd')]
    expect(tasks.query(...conditions).description).toEqual(tasks.query(conditions).description)
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
    adapter.find = jest
      .fn()
      .mockImplementation((table, id, callback) => callback({ value: { id: 'm1' } }))

    // calls db
    const m1 = await collection.find('m1')
    expect(m1._raw).toEqual({ id: 'm1' })
    expect(m1.id).toBe('m1')
    expect(m1.table).toBe('mock_tasks')
    expect(m1.collection).toBe(collection)

    expect(collection._cache.map.size).toBe(1)

    // check call
    expect(adapter.find.mock.calls[0]).toEqual(['mock_tasks', 'm1', expect.anything()])

    // second find will be from cache
    const m1Cached = await collection.find('m1')
    expect(m1Cached).toBe(m1)

    expect(collection._cache.map.size).toBe(1)
    expect(adapter.find.mock.calls.length).toBe(1)
  })
  it('rejects promise if record cannot be found', async () => {
    const { tasks: collection, adapter } = mockDatabase()
    const findSpy = jest.spyOn(adapter, 'find')

    await expect(collection.find('m1')).rejects.toBeInstanceOf(Error)
    await expect(collection.find('m1')).rejects.toBeInstanceOf(Error)

    expect(findSpy.mock.calls.length).toBe(2)
  })
  it('quickly rejects for invalid IDs', async () => {
    const { tasks } = mockDatabase()
    await expectToRejectWithMessage(tasks.find(), 'Invalid record ID')
    await expectToRejectWithMessage(tasks.find(null), 'Invalid record ID')
    await expectToRejectWithMessage(tasks.find({}), 'Invalid record ID')
  })
})

describe('fetching queries', () => {
  it('fetches queries and caches records', async () => {
    const { tasks: collection, adapter } = mockDatabase()

    adapter.query = jest
      .fn()
      .mockImplementation((query, cb) => cb({ value: [{ id: 'm1' }, { id: 'm2' }] }))

    const query = mockQuery(collection)

    // fetch, check models
    const models = await toPromise((callback) => collection._fetchQuery(query, callback))
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

    adapter.query = jest.fn().mockImplementation((query, cb) => cb({ value: ['m1', { id: 'm2' }] }))

    const m1 = new MockTask(collection, { id: 'm1' })
    collection._cache.add(m1)

    // fetch, check models
    const models = await toPromise((cb) => collection._fetchQuery(mockQuery(collection), cb))
    expect(models.length).toBe(2)
    expect(models[0]).toBe(m1)
    expect(models[1]._raw).toEqual({ id: 'm2' })

    // check cache
    expect(collection._cache.map.get('m2')).toBe(models[1])
  })
  it('fetches query records from cache even if full raw object was sent', async () => {
    const { tasks: collection, adapter } = mockDatabase()

    adapter.query = jest
      .fn()
      .mockImplementation((query, cb) => cb({ value: [{ id: 'm1' }, { id: 'm2' }] }))

    const m1 = new MockTask(collection, { id: 'm1' })
    collection._cache.add(m1)

    // fetch, check if error occured
    const spy = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const models = await toPromise((cb) => collection._fetchQuery(mockQuery(collection), cb))
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()

    // check models
    expect(models.length).toBe(2)
    expect(models[0]).toBe(m1)
    expect(models[1]._raw).toEqual({ id: 'm2' })
  })
  it('fetches counts', async () => {
    const { tasks: collection, adapter } = mockDatabase()

    adapter.count = jest.fn().mockImplementationOnce((query, callback) => callback({ value: 5 }))

    const query = mockQuery(collection)
    expect(await toPromise((callback) => collection._fetchCount(query, callback))).toBe(5)

    expect(adapter.count.mock.calls.length).toBe(1)
    expect(adapter.count.mock.calls[0][0]).toEqual(query.serialize())
  })
  it('fetches ids', async () => {
    const { tasks: collection, adapter } = mockDatabase()

    adapter.queryIds = jest
      .fn()
      .mockImplementationOnce((query, callback) => callback({ value: ['a', 'b'] }))

    const query = mockQuery(collection)
    expect(await toPromise((callback) => collection._fetchIds(query, callback))).toEqual(['a', 'b'])

    expect(adapter.queryIds.mock.calls.length).toBe(1)
    expect(adapter.queryIds.mock.calls[0][0]).toEqual(query.serialize())
  })
  it('fetches raws', async () => {
    const { tasks: collection, adapter } = mockDatabase()

    adapter.unsafeQueryRaw = jest
      .fn()
      .mockImplementationOnce((query, callback) => callback({ value: [{ a: 0, b: 1 }] }))

    const query = mockQuery(collection)
    expect(await toPromise((callback) => collection._unsafeFetchRaw(query, callback))).toEqual([
      { a: 0, b: 1 },
    ])

    expect(adapter.unsafeQueryRaw.mock.calls.length).toBe(1)
    expect(adapter.unsafeQueryRaw.mock.calls[0][0]).toEqual(query.serialize())
  })
})

describe('creating new records', () => {
  it('can create records', async () => {
    const { tasks: collection, adapter, db } = mockDatabase()
    const dbBatchSpy = jest.spyOn(adapter, 'batch')

    const observer = jest.fn()
    collection.changes.subscribe(observer)

    // Check Model._prepareCreate was called
    const newModelSpy = jest.spyOn(MockTask, '_prepareCreate')

    const m1 = await db.write(() => collection.create())

    // Check database insert, cache insert, observers update
    expect(m1._preparedState).toBe(null)
    expect(newModelSpy).toHaveBeenCalledTimes(1)
    expect(dbBatchSpy).toHaveBeenCalledTimes(1)
    expect(dbBatchSpy).toHaveBeenCalledWith([['create', 'mock_tasks', m1._raw]], expect.anything())
    expect(observer).toHaveBeenCalledTimes(1)
    expect(observer).toHaveBeenCalledWith([{ record: m1, type: 'created' }])
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

    expect(m1._preparedState).toBe('create')
    expect(newModelSpy).toHaveBeenCalledTimes(1)
    expect(observer).toHaveBeenCalledTimes(0)
    await expect(collection.find(m1.id)).rejects.toBeInstanceOf(Error)
  })
  it('can prepare records from raw', async () => {
    const { tasks: collection } = mockDatabase()

    const newModelSpy = jest.spyOn(MockTask, '_prepareCreateFromDirtyRaw')

    const m1 = collection.prepareCreateFromDirtyRaw({ col3: 'hello' })
    expect(m1._preparedState).toBe('create')
    expect(newModelSpy).toHaveBeenCalledTimes(1)
  })
  it('can prepare a disposable record from raw', async () => {
    const { tasks: collection } = mockDatabase()

    const newModelSpy = jest.spyOn(MockTask, '_disposableFromDirtyRaw')

    const m1 = collection.disposableFromDirtyRaw({ col3: 'hello' })
    expect(m1.syncStatus).toBe('disposable')
    expect(newModelSpy).toHaveBeenCalledTimes(1)
  })
  it('disallows record creating outside of a writer', async () => {
    const { database, tasks } = mockDatabase()

    await expectToRejectWithMessage(
      tasks.create(noop),
      'can only be called from inside of a Writer',
    )
    await expectToRejectWithMessage(
      database.read(() => tasks.create(noop)),
      'can only be called from inside of a Writer',
    )

    // no throw inside writer
    await database.write(() => tasks.create(noop))
  })
})

describe('Collection observation', () => {
  it('can subscribe to collection changes', async () => {
    const { database, tasks } = mockDatabase()

    await database.write(() => tasks.create())

    const subscriber1 = jest.fn()
    const unsubscribe1 = tasks.experimentalSubscribe(subscriber1)

    expect(subscriber1).toHaveBeenCalledTimes(0)

    const t1 = await database.write(() => tasks.create())

    expect(subscriber1).toHaveBeenCalledTimes(1)
    expect(subscriber1).toHaveBeenLastCalledWith([{ record: t1, type: 'created' }])

    const subscriber2 = jest.fn()
    const unsubscribe2 = tasks.experimentalSubscribe(subscriber2)

    await database.write(() => t1.update())

    expect(subscriber1).toHaveBeenCalledTimes(2)
    expect(subscriber2).toHaveBeenCalledTimes(1)
    expect(subscriber2).toHaveBeenLastCalledWith([{ record: t1, type: 'updated' }])

    unsubscribe1()

    await database.write(() => t1.markAsDeleted())

    expect(subscriber1).toHaveBeenCalledTimes(2)
    expect(subscriber2).toHaveBeenCalledTimes(2)
    expect(subscriber2).toHaveBeenLastCalledWith([{ record: t1, type: 'destroyed' }])

    unsubscribe2()

    await database.write(() => tasks.create())
    expect(subscriber2).toHaveBeenCalledTimes(2)
  })
  it('unsubscribe can safely be called more than once', async () => {
    const { database, tasks } = mockDatabase()

    const subscriber1 = jest.fn()
    const unsubscribe1 = tasks.experimentalSubscribe(subscriber1)
    expect(subscriber1).toHaveBeenCalledTimes(0)

    const unsubscribe2 = tasks.experimentalSubscribe(() => {})
    unsubscribe2()
    unsubscribe2()

    await database.write(() => tasks.create())
    expect(subscriber1).toHaveBeenCalledTimes(1)

    unsubscribe1()
  })
  it(`can subscribe with the same subscriber multiple times`, async () => {
    const { database, tasks } = mockDatabase()
    const trigger = () => database.write(() => tasks.create())
    const subscriber = jest.fn()

    const unsubscribe1 = tasks.experimentalSubscribe(subscriber)
    expect(subscriber).toHaveBeenCalledTimes(0)
    await trigger()
    expect(subscriber).toHaveBeenCalledTimes(1)
    const unsubscribe2 = tasks.experimentalSubscribe(subscriber)
    await trigger()
    expect(subscriber).toHaveBeenCalledTimes(3)
    unsubscribe2()
    unsubscribe2() // noop
    await trigger()
    expect(subscriber).toHaveBeenCalledTimes(4)
    unsubscribe1()
    await trigger()
    expect(subscriber).toHaveBeenCalledTimes(4)
  })
})

describe('findAndObserve', () => {
  it('observes an existing record and completes when it is deleted', async () => {
    const { database, tasks } = mockDatabase()
    const t1 = await database.write(() => tasks.create())

    const observer = jest.fn()
    const complete = jest.fn()
    tasks.findAndObserve(t1.id).subscribe(observer, undefined, complete)

    await new Promise(process.nextTick)
    expect(observer).toHaveBeenCalledTimes(1)
    expect(observer).toHaveBeenLastCalledWith(t1)

    await database.write(() => t1.update())
    expect(observer).toHaveBeenCalledTimes(2)
    expect(observer).toHaveBeenLastCalledWith(t1)

    await database.write(() => t1.markAsDeleted())
    expect(observer).toHaveBeenCalledTimes(2)
    expect(complete).toHaveBeenCalledTimes(1)
  })
  it('errors if the record does not exist', async () => {
    const { tasks } = mockDatabase()

    const observer = jest.fn()
    const error = jest.fn()
    tasks.findAndObserve('missing').subscribe(observer, error)

    await new Promise(process.nextTick)
    expect(observer).toHaveBeenCalledTimes(0)
    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0][0].message).toMatch('Record mock_tasks#missing not found')
  })
})

describe('observeRecord', () => {
  const createWithId = (database, collection, id) =>
    database.write(() =>
      collection.create((record) => {
        record._raw.id = id
      }),
    )

  it('emits null if the record does not exist', async () => {
    const { tasks } = mockDatabase()

    const observer = jest.fn()
    const error = jest.fn()
    const complete = jest.fn()
    tasks.observeRecord('missing').subscribe(observer, error, complete)

    await new Promise(process.nextTick)
    expect(observer).toHaveBeenCalledTimes(1)
    expect(observer).toHaveBeenLastCalledWith(null)
    expect(error).toHaveBeenCalledTimes(0)
    expect(complete).toHaveBeenCalledTimes(0)
  })
  it('emits the record once a record with this id is created', async () => {
    const { database, tasks } = mockDatabase()

    const observer = jest.fn()
    const subscription = tasks.observeRecord('later').subscribe(observer)

    await new Promise(process.nextTick)
    expect(observer).toHaveBeenCalledTimes(1)
    expect(observer).toHaveBeenLastCalledWith(null)

    // unrelated records don't matter
    await database.write(() => tasks.create())
    expect(observer).toHaveBeenCalledTimes(1)

    const t1 = await createWithId(database, tasks, 'later')
    expect(observer).toHaveBeenCalledTimes(2)
    expect(observer).toHaveBeenLastCalledWith(t1)

    // ...and then keeps observing the record
    await database.write(() => t1.update())
    expect(observer).toHaveBeenCalledTimes(3)
    expect(observer).toHaveBeenLastCalledWith(t1)

    subscription.unsubscribe()
    await database.write(() => t1.update())
    expect(observer).toHaveBeenCalledTimes(3)
  })
  it('emits null instead of completing when the record is deleted, and recovers', async () => {
    const { database, tasks } = mockDatabase()
    const t1 = await createWithId(database, tasks, 't1')

    const observer = jest.fn()
    const error = jest.fn()
    const complete = jest.fn()
    const subscription = tasks.observeRecord('t1').subscribe(observer, error, complete)

    // record is cached, so it's emitted synchronously
    expect(observer).toHaveBeenCalledTimes(1)
    expect(observer).toHaveBeenLastCalledWith(t1)

    await database.write(() => t1.markAsDeleted())
    expect(observer).toHaveBeenCalledTimes(2)
    expect(observer).toHaveBeenLastCalledWith(null)
    expect(complete).toHaveBeenCalledTimes(0)

    // purge the deleted record (like sync does), then re-create a record with the same id
    await database.adapter.destroyDeletedRecords('mock_tasks', ['t1'])
    const t1Again = await createWithId(database, tasks, 't1')
    expect(t1Again).not.toBe(t1)
    expect(observer).toHaveBeenCalledTimes(3)
    expect(observer).toHaveBeenLastCalledWith(t1Again)

    await database.write(() => t1Again.destroyPermanently())
    expect(observer).toHaveBeenCalledTimes(4)
    expect(observer).toHaveBeenLastCalledWith(null)

    expect(error).toHaveBeenCalledTimes(0)
    expect(complete).toHaveBeenCalledTimes(0)
    subscription.unsubscribe()
  })
  it('fetches records that are not cached, including ids containing colons', async () => {
    const { database, tasks: originalTasks, cloneDatabase } = mockDatabase()
    const id = '12:Quiz:hand'
    await createWithId(database, originalTasks, id)

    // simulate reload - the record is in the database, but not in cache
    const reloadedDb = await cloneDatabase()
    const tasks = reloadedDb.get('mock_tasks')
    const findSpy = jest.spyOn(reloadedDb.adapter.underlyingAdapter, 'find')

    const observer = jest.fn()
    tasks.observeRecord(id).subscribe(observer)
    expect(observer).toHaveBeenCalledTimes(0)

    await new Promise(process.nextTick)
    expect(findSpy).toHaveBeenCalledTimes(1)
    expect(findSpy.mock.calls[0].slice(0, 2)).toEqual(['mock_tasks', id])
    expect(observer).toHaveBeenCalledTimes(1)
    expect(observer.mock.calls[0][0].id).toBe(id)

    // a missing record with such an id is also fine
    const observer2 = jest.fn()
    tasks.observeRecord('12:Quiz:missing').subscribe(observer2)
    await new Promise(process.nextTick)
    expect(observer2).toHaveBeenLastCalledWith(null)
  })
  it('does not emit twice if the record is created while fetching', async () => {
    const { database, tasks, adapter } = mockDatabase()

    let finishFind = null
    adapter.find = jest.fn().mockImplementation((table, id, callback) => {
      finishFind = () => callback({ value: null })
    })

    const observer = jest.fn()
    tasks.observeRecord('t1').subscribe(observer)
    expect(adapter.find).toHaveBeenCalledTimes(1)

    const t1 = await createWithId(database, tasks, 't1')
    expect(observer).toHaveBeenCalledTimes(1)
    expect(observer).toHaveBeenLastCalledWith(t1)

    finishFind()
    expect(observer).toHaveBeenCalledTimes(1)
  })
  it('notifies every subscription when the record is deleted', async () => {
    const { database, tasks } = mockDatabase()
    const t1 = await createWithId(database, tasks, 't1')

    const observers = [jest.fn(), jest.fn(), jest.fn()]
    observers.forEach((observer) => tasks.observeRecord('t1').subscribe(observer))
    observers.forEach((observer) => expect(observer).toHaveBeenLastCalledWith(t1))

    await database.write(() => t1.markAsDeleted())
    observers.forEach((observer) => {
      expect(observer).toHaveBeenCalledTimes(2)
      expect(observer).toHaveBeenLastCalledWith(null)
    })
    expect(t1._subscribers.length).toBe(0)
  })
  it('emits null for records marked as deleted', async () => {
    const { database, tasks } = mockDatabase()
    const t1 = await createWithId(database, tasks, 't1')
    await database.write(() => t1.markAsDeleted())
    expect(tasks._cache.get('t1')).toBe(undefined)

    const observer = jest.fn()
    tasks.observeRecord('t1').subscribe(observer)
    await new Promise(process.nextTick)

    expect(observer).toHaveBeenCalledTimes(1)
    expect(observer).toHaveBeenLastCalledWith(null)

    // find() semantics are unchanged
    expect((await tasks.find('t1')).syncStatus).toBe('deleted')
  })
  it('does not leak listeners when the consumer unsubscribes synchronously', async () => {
    const { database, tasks } = mockDatabase()

    // record created later
    const observer = jest.fn()
    tasks
      .observeRecord('t1')
      .pipe(filter(Boolean), take(1))
      .subscribe(observer)
    await new Promise(process.nextTick)
    const t1 = await createWithId(database, tasks, 't1')
    expect(observer).toHaveBeenCalledTimes(1)
    expect(observer).toHaveBeenLastCalledWith(t1)
    expect(t1._subscribers.length).toBe(0)
    expect(tasks._subscribers.length).toBe(0)

    // cached record emitted synchronously on subscription
    const observer2 = jest.fn()
    tasks.observeRecord('t1').pipe(take(1)).subscribe(observer2)
    expect(observer2).toHaveBeenLastCalledWith(t1)
    expect(t1._subscribers.length).toBe(0)
    expect(tasks._subscribers.length).toBe(0)
  })
  it('only listens to collection changes while the record is missing', async () => {
    const { database, tasks } = mockDatabase()

    const observer = jest.fn()
    const subscription = tasks.observeRecord('t1').subscribe(observer)
    await new Promise(process.nextTick)
    expect(tasks._subscribers.length).toBe(1)

    const t1 = await createWithId(database, tasks, 't1')
    expect(observer).toHaveBeenLastCalledWith(t1)
    expect(tasks._subscribers.length).toBe(0)
    expect(t1._subscribers.length).toBe(1)

    await database.write(() => t1.markAsDeleted())
    expect(observer).toHaveBeenLastCalledWith(null)
    expect(tasks._subscribers.length).toBe(1)
    expect(t1._subscribers.length).toBe(0)

    subscription.unsubscribe()
    expect(tasks._subscribers.length).toBe(0)
  })
  it('does not emit a record created and deleted within batched notifications', async () => {
    const { database, tasks } = mockDatabase()

    const observer = jest.fn()
    tasks.observeRecord('t1').subscribe(observer)
    await new Promise(process.nextTick)
    expect(observer).toHaveBeenLastCalledWith(null)

    await database.experimentalBatchNotifications(async () => {
      const t1 = await createWithId(database, tasks, 't1')
      await database.write(() => t1.destroyPermanently())
    })
    expect(observer).toHaveBeenCalledTimes(1)
  })
  it('switches to a record deleted and re-created within batched notifications', async () => {
    const { database, tasks } = mockDatabase()
    const t1 = await createWithId(database, tasks, 't1')

    const observer = jest.fn()
    tasks.observeRecord('t1').subscribe(observer)
    expect(observer).toHaveBeenLastCalledWith(t1)

    let t1Again
    await database.experimentalBatchNotifications(async () => {
      await database.write(() => t1.destroyPermanently())
      t1Again = await createWithId(database, tasks, 't1')
    })
    expect(observer).toHaveBeenCalledTimes(2)
    expect(observer).toHaveBeenLastCalledWith(t1Again)
    expect(t1._subscribers.length).toBe(0)
    expect(t1Again._subscribers.length).toBe(1)
  })
  it('emits null if the record is created and deleted while the initial fetch is pending', async () => {
    const { database, tasks, adapter } = mockDatabase()

    let finishFind = null
    adapter.find = jest.fn().mockImplementation((table, id, callback) => {
      finishFind = () => callback({ value: null })
    })

    const observer = jest.fn()
    tasks.observeRecord('t1').subscribe(observer)
    expect(observer).toHaveBeenCalledTimes(0)

    await database.experimentalBatchNotifications(async () => {
      const t1 = await createWithId(database, tasks, 't1')
      await database.write(() => t1.destroyPermanently())
    })
    expect(observer.mock.calls).toEqual([[null]])

    finishFind()
    expect(observer.mock.calls).toEqual([[null]])

    // ...and still recovers
    const t1Again = await createWithId(database, tasks, 't1')
    expect(observer.mock.calls).toEqual([[null], [t1Again]])
  })
  it('ignores the initial fetch result if the record changed in the meantime', async () => {
    const { database, tasks, adapter } = mockDatabase()

    let finishFind = null
    adapter.find = jest.fn().mockImplementation((table, id, callback) => {
      finishFind = () => callback({ value: { id: 't1', _status: 'synced', _changed: '' } })
    })

    const observer = jest.fn()
    tasks.observeRecord('t1').subscribe(observer)

    const t1 = await createWithId(database, tasks, 't1')
    await database.write(() => t1.markAsDeleted())
    expect(observer.mock.calls).toEqual([[t1], [null]])

    // outdated result of the initial fetch arrives late
    finishFind()
    expect(observer.mock.calls).toEqual([[t1], [null]])
  })
  it('does not emit an update of a record deleted within batched notifications', async () => {
    const { database, tasks } = mockDatabase()
    const t1 = await createWithId(database, tasks, 't1')

    const observer = jest.fn()
    tasks.observeRecord('t1').subscribe(observer)
    expect(observer.mock.calls).toEqual([[t1]])

    await database.experimentalBatchNotifications(async () => {
      await database.write(() => t1.update())
      await database.write(() => t1.markAsDeleted())
    })
    expect(observer.mock.calls).toEqual([[t1], [null]])
  })
  it('errors for invalid ids', async () => {
    const { tasks } = mockDatabase()

    const observer = jest.fn()
    const error = jest.fn()
    tasks.observeRecord(null).subscribe(observer, error)

    expect(observer).toHaveBeenCalledTimes(0)
    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0][0].message).toMatch('Invalid record ID')
  })
  it('stops observing after unsubscribing', async () => {
    const { database, tasks } = mockDatabase()

    const observer = jest.fn()
    const subscription = tasks.observeRecord('t1').subscribe(observer)
    await new Promise(process.nextTick)
    expect(observer).toHaveBeenCalledTimes(1)

    subscription.unsubscribe()
    expect(tasks._subscribers.length).toBe(0)

    const t1 = await createWithId(database, tasks, 't1')
    await database.write(() => t1.markAsDeleted())
    expect(observer).toHaveBeenCalledTimes(1)
    expect(t1._subscribers.length).toBe(0)
  })
})
