import { expectToRejectWithMessage } from '../__tests__/utils'
import { mockDatabase, MockProject, MockTask, MockComment } from '../__tests__/testModels'
import { noop } from '../utils/fp'
import { CollectionChangeTypes } from '../Collection/common'
import Database from './index'

describe('Database', () => {
  it('implements collectionMap', () => {
    const database = new Database({
      adapter: { schema: null },
      modelClasses: [MockProject, MockTask, MockComment],
    })
    const projects = database.collections.get('mock_projects')
    const tasks = database.collections.get('mock_tasks')
    expect(projects.modelClass).toBe(MockProject)
    expect(projects.table).toBe('mock_projects')
    expect(tasks.modelClass).toBe(MockTask)
    expect(database.collections.get('non_existent')).toBeUndefined()
  })
})

describe('unsafeResetDatabase', () => {
  it('can reset database', async () => {
    const { database, tasks } = mockDatabase({ actionsEnabled: true })

    const m1 = await database.action(() => tasks.create())
    const m2 = await database.action(() => tasks.create())

    expect(await tasks.find(m1.id)).toBe(m1)
    expect(await tasks.find(m2.id)).toBe(m2)

    // reset
    await database.action(() => database.unsafeResetDatabase())

    await expectToRejectWithMessage(tasks.find(m1.id), /not found/)
    await expectToRejectWithMessage(tasks.find(m2.id), /not found/)
  })
  it('throws error if reset is called from outside an Action', async () => {
    const { database, tasks } = mockDatabase({ actionsEnabled: true })
    const m1 = await database.action(() => tasks.create())

    await expectToRejectWithMessage(
      database.unsafeResetDatabase(),
      /can only be called from inside of an Action/,
    )

    expect(await tasks.find(m1.id)).toBe(m1)
  })
  it('increments reset count after every reset', async () => {
    const { database } = mockDatabase({ actionsEnabled: true })
    expect(database._resetCount).toBe(0)

    await database.action(() => database.unsafeResetDatabase())
    expect(database._resetCount).toBe(1)

    await database.action(() => database.unsafeResetDatabase())
    expect(database._resetCount).toBe(2)
  })
})

describe('Batch writes', () => {
  it('can batch records', async () => {
    // eslint-disable-next-line
    let { database, cloneDatabase, tasks: collection } = mockDatabase({ actionsEnabled: true })
    const adapterBatchSpy = jest.spyOn(database.adapter, 'batch')

    const m1 = await database.action(() => collection.create())
    const m2 = await database.action(() => collection.create())

    const collectionObserver = jest.fn()
    collection.changes.subscribe(collectionObserver)

    const m3 = collection.prepareCreate()
    const m4 = collection.prepareCreate()

    const recordObserver = jest.fn()
    m1.observe().subscribe(recordObserver)

    const batchPromise = database.action(() =>
      database.batch(
        m3,
        m1.prepareUpdate(() => {
          m1.name = 'bar1'
        }),
        m4,
        m2.prepareUpdate(() => {
          m2.name = 'baz1'
        }),
      ),
    )

    expect(m1._hasPendingUpdate).toBe(false)
    expect(m2._hasPendingUpdate).toBe(false)

    await batchPromise

    expect(adapterBatchSpy).toHaveBeenCalledTimes(3)
    expect(adapterBatchSpy).toHaveBeenLastCalledWith([
      ['create', m3],
      ['update', m1],
      ['create', m4],
      ['update', m2],
    ])

    expect(collectionObserver).toHaveBeenCalledTimes(1)
    expect(collectionObserver).toHaveBeenCalledWith([
        { record: m3, type: CollectionChangeTypes.created },
        { record: m1, type: CollectionChangeTypes.updated },
        { record: m4, type: CollectionChangeTypes.created },
        { record: m2, type: CollectionChangeTypes.updated },
    ])

    const createdRecords = [m3, m4]
    createdRecords.forEach(record => {
      expect(record._isCommitted).toBe(true)
      expect(collection._cache.get(record.id)).toBe(record)
    })

    expect(recordObserver).toHaveBeenCalledTimes(2)

    // simulate reload -- check if changes actually got saved
    database = cloneDatabase()
    collection = database.collections.get('mock_tasks')

    const fetchedM1 = await collection.find(m1.id)
    const fetchedM2 = await collection.find(m2.id)
    expect(fetchedM1.name).toBe('bar1')
    expect(fetchedM2.name).toBe('baz1')
  })
  it('throws error if attempting to batch records without a pending operation', async () => {
    const { database, tasks } = mockDatabase({ actionsEnabled: true })
    const m1 = await database.action(() => tasks.create())

    await expectToRejectWithMessage(
      database.action(() => database.batch(m1)),
      /doesn't have a prepared create or prepared update/,
    )
  })
  it('throws error if batch is called outside of an action', async () => {
    const { database, tasks } = mockDatabase({ actionsEnabled: true })

    await expectToRejectWithMessage(
      database.batch(tasks.prepareCreate(noop)),
      /can only be called from inside of an Action/,
    )

    // check if in action is successful
    await database.action(() =>
      database.batch(
        tasks.prepareCreate(task => {
          task.name = 'foo1'
        }),
      ),
    )
    const [task] = await tasks.query().fetch()
    expect(task.name).toBe('foo1')
  })
})

describe('Observation', () => {
  it('implements withChangesForTables', async () => {
    const { database, projects, tasks, comments } = mockDatabase({ actionsEnabled: true })

    const observer = jest.fn()
    database.withChangesForTables(['mock_projects', 'mock_tasks']).subscribe(observer)

    expect(observer).toHaveBeenCalledTimes(1)

    await database.action(() => projects.create())
    const m1 = await database.action(() => projects.create())
    const m2 = await database.action(() => tasks.create())
    const m3 = await database.action(() => comments.create())

    expect(observer).toHaveBeenCalledTimes(4)
    expect(observer).toHaveBeenCalledWith([{ record: m1, type: CollectionChangeTypes.created }])
    expect(observer).toHaveBeenLastCalledWith([{ record: m2, type: CollectionChangeTypes.created }])

    await database.action(async () => {
      await m1.update()
      await m2.update()
      await m3.update()
    })

    expect(observer).toHaveBeenCalledTimes(6)
    expect(observer).toHaveBeenLastCalledWith([{ record: m2, type: CollectionChangeTypes.updated }])

    await database.action(async () => {
      await m1.destroyPermanently()
      await m2.destroyPermanently()
      await m3.destroyPermanently()
    })

    expect(observer).toHaveBeenCalledTimes(8)
    expect(observer).toHaveBeenCalledWith([{ record: m1, type: CollectionChangeTypes.destroyed }])
    expect(observer).toHaveBeenLastCalledWith([
      { record: m2, type: CollectionChangeTypes.destroyed },
    ])
  })
})

const delayPromise = () => new Promise(resolve => setTimeout(resolve, 100))

describe('Database actions', () => {
  it('can execute an action', async () => {
    const { database } = mockDatabase()

    const action = jest.fn(() => Promise.resolve(true))
    await database.action(action)

    expect(action).toHaveBeenCalledTimes(1)
  })
  it('queues actions', async () => {
    const { database } = mockDatabase()

    const actions = [jest.fn(delayPromise), jest.fn(delayPromise), jest.fn(delayPromise)]

    const promise0 = database.action(actions[0])
    database.action(actions[1])

    expect(actions[0]).toHaveBeenCalledTimes(1)
    expect(actions[1]).toHaveBeenCalledTimes(0)

    await promise0
    const promise2 = database.action(actions[2])

    expect(actions[0]).toHaveBeenCalledTimes(1)
    expect(actions[1]).toHaveBeenCalledTimes(0)
    expect(actions[2]).toHaveBeenCalledTimes(0)

    await promise2

    expect(actions[0]).toHaveBeenCalledTimes(1)
    expect(actions[1]).toHaveBeenCalledTimes(1)
    expect(actions[2]).toHaveBeenCalledTimes(1)

    // after queue is empty I can queue again and have result immediately
    const action3 = jest.fn(async () => 42)
    const promise3 = database.action(action3)
    expect(action3).toHaveBeenCalledTimes(1)
    await promise3
  })
  it('returns value from action', async () => {
    const { database } = mockDatabase()
    const result = await database.action(async () => 42)
    expect(result).toBe(42)
  })
  it('passes error from action', async () => {
    const { database } = mockDatabase()
    await expectToRejectWithMessage(
      database.action(async () => {
        throw new Error('test error')
      }),
      'test error',
    )
  })
  it('queues actions correctly even if some error out', async () => {
    const { database } = mockDatabase()

    const actions = [
      async () => true,
      async () => {
        throw new Error('error1') // async error
      },
      async () => {
        await delayPromise()
        return 42
      },
      () => {
        throw new Error('error2') // sync error
      },
      () => delayPromise(),
    ]
    const promises = actions.map(action =>
      database.action(action).then(
        // jest will automatically fail the test if a promise rejects even though we're testing it later
        value => ['value', value],
        error => ['error', error],
      ),
    )
    await promises[4]

    // after queue is empty I can queue again
    const action5 = jest.fn(async () => 42)
    const promise5 = database.action(action5)
    expect(action5).toHaveBeenCalledTimes(1)

    // check if right answers
    expect(await promises[0]).toEqual(['value', true])
    expect(await promises[1]).toMatchObject(['error', { message: 'error1' }])
    expect(await promises[2]).toEqual(['value', 42])
    expect(await promises[3]).toMatchObject(['error', { message: 'error2' }])
    expect(await promises[4]).toEqual(['value', undefined])
    await promise5
  })
  it('action calling another action directly will get stuck', async () => {
    const { database } = mockDatabase()

    let called = 0
    const subaction = () =>
      database.action(async () => {
        called += 1
      })

    await database.action(() => {
      subaction()
      return delayPromise() // don't await subaction, just see it will never be called
    })
    expect(called).toBe(0)
  })
  it('can call subactions with subAction()', async () => {
    const { database } = mockDatabase()

    const action2 = () => database.action(async () => 32)
    const result = await database.action(async action => {
      const a = await action.subAction(() => action2())
      return a + 10
    })
    expect(result).toBe(42)
  })
  it('can arbitrarily nest subactions', async () => {
    const { database } = mockDatabase()

    const action1 = () => database.action(async () => 42)
    const action2 = () => database.action(async action => action.subAction(() => action1()))
    const action3 = () => database.action(async action => action.subAction(() => action2()))
    expect(await action3()).toBe(42)
  })
  it('sub actions skip the line only once', async () => {
    const { database } = mockDatabase()

    let called1 = 0
    let called2 = 0

    const action1 = () =>
      database.action(async () => {
        called1 += 1
      })
    const action2 = () =>
      database.action(async () => {
        called2 += 1
      })
    await database.action(action => {
      action.subAction(() => action1())
      action2()
      return delayPromise() // don't await subaction, just see it will never be called
    })
    expect(called1).toBe(1)
    expect(called2).toBe(0)
  })
  it('aborts all pending actions if database is reset', async () => {
    const { database } = mockDatabase({ actionsEnabled: true })

    let promise1
    let promise2
    let promise3
    let dangerousActionsCalled = 0
    let safeActionsCalled = 0

    const manyActions = async () => {
      // this will be called before reset:
      promise1 = database.action(async () => 1)
      await promise1

      // this will be called after reset:
      promise2 = database.action(async () => {
        dangerousActionsCalled += 1
      })
      await promise2

      promise3 = database.action(async () => {
        dangerousActionsCalled += 1
      })
      await promise3
    }

    const promises = manyActions().catch(e => e)
    await database.action(() => database.unsafeResetDatabase())

    // actions beyond unsafe reset should be successful
    await Promise.all([
      database.action(async () => {
        safeActionsCalled += 1
      }),
      database.action(async () => {
        safeActionsCalled += 1
      }),
    ])

    expect(await promises).toMatchObject({ message: expect.stringMatching(/database was reset/) })

    expect(await promise1).toBe(1)
    await expectToRejectWithMessage(promise2, /database was reset/)
    expect(promise3).toBe(undefined) // code will never reach this point
    expect(dangerousActionsCalled).toBe(0)
    expect(safeActionsCalled).toBe(2)
  })
})
