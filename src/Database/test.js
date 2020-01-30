import { expectToRejectWithMessage } from '../__tests__/utils'
import { mockDatabase, MockProject, MockTask, MockComment } from '../__tests__/testModels'
import { noop } from '../utils/fp'
import { CollectionChangeTypes } from '../Collection/common'
import Database from './index'
import * as Q from '../QueryDescription'

describe('Database', () => {
  it('implements collectionMap', () => {
    const database = new Database({
      adapter: { schema: null },
      modelClasses: [MockProject, MockTask, MockComment],
      actionsEnabled: true,
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
    let {
      database,
      // eslint-disable-next-line
      cloneDatabase,
      tasks: tasksCollection,
      comments: commentsCollection,
    } = mockDatabase({ actionsEnabled: true })
    const adapterBatchSpy = jest.spyOn(database.adapter, 'batch')

    // m1, m2 will be used to test batch-updates
    const m1 = await database.action(() => tasksCollection.create())
    const m2 = await database.action(() => commentsCollection.create())

    // m3, m4 will be used to test batch-deletes
    const m3 = await database.action(() => tasksCollection.create())
    const m4 = await database.action(() => commentsCollection.create())

    const tasksCollectionObserver = jest.fn()
    tasksCollection.changes.subscribe(tasksCollectionObserver)

    const commentsCollectionObserver = jest.fn()
    commentsCollection.changes.subscribe(commentsCollectionObserver)

    // m5, m6 will be used to test batch-creates
    const m5 = tasksCollection.prepareCreate()
    const m6 = commentsCollection.prepareCreate()

    const recordObserver = jest.fn()
    m1.observe().subscribe(recordObserver)

    const batchPromise = database.action(() =>
      database.batch(
        m6,
        m1.prepareUpdate(() => {
          m1.name = 'bar1'
        }),
        m5,
        m2.prepareUpdate(() => {
          m2.body = 'baz1'
        }),
        m3.prepareMarkAsDeleted(),
        m4.prepareDestroyPermanently(),
      ),
    )

    expect(m1._hasPendingUpdate).toBe(false)
    expect(m2._hasPendingUpdate).toBe(false)

    await batchPromise

    expect(adapterBatchSpy).toHaveBeenCalledTimes(5)
    expect(adapterBatchSpy).toHaveBeenLastCalledWith([
      ['create', 'mock_comments', m6._raw],
      ['update', 'mock_tasks', m1._raw],
      ['create', 'mock_tasks', m5._raw],
      ['update', 'mock_comments', m2._raw],
      ['markAsDeleted', 'mock_tasks', m3.id],
      ['destroyPermanently', 'mock_comments', m4.id],
    ])

    expect(tasksCollectionObserver).toHaveBeenCalledTimes(1)
    expect(commentsCollectionObserver).toHaveBeenCalledTimes(1)
    expect(tasksCollectionObserver).toHaveBeenCalledWith([
      { record: m1, type: CollectionChangeTypes.updated },
      { record: m5, type: CollectionChangeTypes.created },
      { record: m3, type: CollectionChangeTypes.destroyed },
    ])
    expect(commentsCollectionObserver).toHaveBeenCalledWith([
      { record: m6, type: CollectionChangeTypes.created },
      { record: m2, type: CollectionChangeTypes.updated },
      { record: m4, type: CollectionChangeTypes.destroyed },
    ])

    const createdRecords = [m5, m6]
    createdRecords.forEach(record => {
      expect(record._isCommitted).toBe(true)
      expect(record.collection._cache.get(record.id)).toBe(record)
    })

    expect(recordObserver).toHaveBeenCalledTimes(2)

    // simulate reload -- check if changes actually got saved
    database = cloneDatabase()
    tasksCollection = database.collections.get('mock_tasks')
    commentsCollection = database.collections.get('mock_comments')

    const fetchedM1 = await tasksCollection.find(m1.id)
    const fetchedM2 = await commentsCollection.find(m2.id)
    expect(fetchedM1.name).toBe('bar1')
    expect(fetchedM2.body).toBe('baz1')

    const fetchedM3 = await tasksCollection.find(m3.id)
    const fetchedM4 = await commentsCollection.query(Q.where('id', m4.id)).fetch()
    expect(fetchedM3._raw._status).toBe('deleted')
    expect(fetchedM4.length).toBe(0)
  })
  it('ignores falsy values passed', async () => {
    const { database, tasks: tasksCollection } = mockDatabase({ actionsEnabled: true })
    const adapterBatchSpy = jest.spyOn(database.adapter, 'batch')

    const model = tasksCollection.prepareCreate()
    await database.action(() => database.batch(null, model, false, undefined))

    expect(adapterBatchSpy).toHaveBeenCalledTimes(1)
    expect(adapterBatchSpy).toHaveBeenLastCalledWith([['create', 'mock_tasks', model._raw]])
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
  it('can subscribe to change signals for particular tables', async () => {
    const { database, projects, tasks, comments } = mockDatabase({ actionsEnabled: true })

    const subscriber1 = jest.fn()
    const unsubscribe1 = database.experimentalSubscribe([], subscriber1)

    await database.action(() => tasks.create())

    const subscriber2 = jest.fn()
    const unsubscribe2 = database.experimentalSubscribe(['mock_tasks'], subscriber2)

    const subscriber3 = jest.fn()
    const unsubscribe3 = database.experimentalSubscribe(
      ['mock_tasks', 'mock_projects'],
      subscriber3,
    )

    const p1 = await database.action(() => projects.create())
    await database.action(() => tasks.create())
    await database.action(() => comments.create())

    expect(subscriber1).toHaveBeenCalledTimes(0)
    expect(subscriber2).toHaveBeenCalledTimes(1)
    expect(subscriber3).toHaveBeenCalledTimes(2)
    expect(subscriber2).toHaveBeenLastCalledWith()

    await database.action(() =>
      database.batch(projects.prepareCreate(), projects.prepareCreate(), tasks.prepareCreate()),
    )

    expect(subscriber2).toHaveBeenCalledTimes(2)
    expect(subscriber3).toHaveBeenCalledTimes(3)

    await database.action(() => p1.update())

    expect(subscriber2).toHaveBeenCalledTimes(2)
    expect(subscriber3).toHaveBeenCalledTimes(4)

    unsubscribe1()
    unsubscribe2()

    await database.action(() =>
      database.batch(tasks.prepareCreate(), p1.prepareDestroyPermanently()),
    )

    expect(subscriber1).toHaveBeenCalledTimes(0)
    expect(subscriber2).toHaveBeenCalledTimes(2)
    expect(subscriber3).toHaveBeenCalledTimes(5)
    unsubscribe3()
  })
  it('unsubscribe can safely be called more than once', async () => {
    const { database, tasks } = mockDatabase({ actionsEnabled: true })

    const subscriber1 = jest.fn()
    const unsubscribe1 = database.experimentalSubscribe(['mock_tasks'], subscriber1)
    expect(subscriber1).toHaveBeenCalledTimes(0)

    const unsubscribe2 = database.experimentalSubscribe(['mock_tasks'], () => {})
    unsubscribe2()
    unsubscribe2()

    await database.action(() => tasks.create())

    expect(subscriber1).toHaveBeenCalledTimes(1)
    unsubscribe1()
  })
  it('has new objects cached before calling subscribers (regression test)', async () => {
    const { database, projects, tasks } = mockDatabase({ actionsEnabled: true })

    const project = projects.prepareCreate()
    const task = tasks.prepareCreate(t => {
      t.project.set(project)
    })

    let observerCalled = 0
    let taskPromise = null
    const observer = jest.fn(() => {
      observerCalled += 1
      if (observerCalled === 1) {
        // nothing happens
      } else if (observerCalled === 2) {
        taskPromise = tasks.find(task.id)
      }
    })
    database.withChangesForTables(['mock_projects']).subscribe(observer)
    expect(observer).toHaveBeenCalledTimes(1)

    await database.action(() => database.batch(project, task))
    expect(observer).toHaveBeenCalledTimes(2)

    // check if task is already cached
    expect(await taskPromise).toBe(task)
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
