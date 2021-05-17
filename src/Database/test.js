import { expectToRejectWithMessage } from '../__tests__/utils'
import { mockDatabase } from '../__tests__/testModels'
import { noop } from '../utils/fp'
import { CollectionChangeTypes } from '../Collection/common'
import * as Q from '../QueryDescription'

describe('Database', () => {
  it(`implements get()`, () => {
    const { database } = mockDatabase()
    expect(database.get('mock_tasks').table).toBe('mock_tasks')
    expect(database.get('mock_tasks')).toBe(database.collections.get('mock_tasks'))
    expect(database.get('mock_comments')).toBe(database.collections.get('mock_comments'))
  })

  describe('unsafeResetDatabase', () => {
    it('can reset database', async () => {
      const { database, tasks } = mockDatabase()

      const m1 = await database.write(() => tasks.create())
      const m2 = await database.write(() => tasks.create())

      expect(await tasks.find(m1.id)).toBe(m1)
      expect(await tasks.find(m2.id)).toBe(m2)

      // reset
      await database.write(() => database.unsafeResetDatabase())

      await expectToRejectWithMessage(tasks.find(m1.id), 'not found')
      await expectToRejectWithMessage(tasks.find(m2.id), 'not found')
    })
    it('throws error if reset is called from outside a writer', async () => {
      const { database, tasks } = mockDatabase()
      const m1 = await database.write(() => tasks.create())

      await expectToRejectWithMessage(
        database.unsafeResetDatabase(),
        'can only be called from inside of a Writer',
      )
      await expectToRejectWithMessage(
        database.read(() => database.unsafeResetDatabase()),
        'can only be called from inside of a Writer',
      )

      expect(await tasks.find(m1.id)).toBe(m1)
    })
    it('increments reset count after every reset', async () => {
      const { database } = mockDatabase()
      expect(database._resetCount).toBe(0)

      await database.write(() => database.unsafeResetDatabase())
      expect(database._resetCount).toBe(1)

      await database.write(() => database.unsafeResetDatabase())
      expect(database._resetCount).toBe(2)
    })
    it('prevents Adapter from being called during reset db', async () => {
      const { database } = mockDatabase()

      const checkAdapter = async () => {
        expect(await database.adapter.getLocal('test')).toBe(null)
        expect(database.adapter.underlyingAdapter).not.toBeFalsy()
        expect(database.adapter.schema).not.toBeFalsy()
      }
      await checkAdapter()

      const resetPromise = database.write(() => database.unsafeResetDatabase())

      expect(() => database.adapter.underlyingAdapter).toThrow(
        /Cannot call database.adapter.underlyingAdapter while the database is being reset/,
      )
      expect(() => database.adapter.schema).toThrow(/Cannot call database.adapter.schema/)
      expect(() => database.adapter.migrations).toThrow(/Cannot call database.adapter.migrations/)
      expect(() => database.adapter.getLocal('test')).toThrow(
        /Cannot call database.adapter.getLocal/,
      )
      expect(() => database.adapter.setLocal('test', 'trap')).toThrow(
        /Cannot call database.adapter.setLocal/,
      )

      await resetPromise
      await checkAdapter()
    })
    it('Cancels Database experimental subscribers during reset', async () => {
      const { database, tasks } = mockDatabase()

      // sanity check first
      const subscriber1 = jest.fn()
      const unsubscribe1 = database.experimentalSubscribe(['mock_tasks'], subscriber1)
      await database.write(() => tasks.create())
      expect(subscriber1).toHaveBeenCalledTimes(1)
      unsubscribe1()
      await database.write(() => database.unsafeResetDatabase())
      await database.write(() => tasks.create())
      expect(subscriber1).toHaveBeenCalledTimes(1)

      // keep subscriber during reset
      const subscriber2 = jest.fn()
      database.experimentalSubscribe(['mock_tasks'], subscriber2)
      const consoleErrorSpy = jest.spyOn(console, 'log')

      await database.write(() => database.unsafeResetDatabase())

      // check that error was logged
      expect(consoleErrorSpy).toHaveBeenCalledTimes(2)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Application error! Unexpected 1 Database subscribers were detected during database.unsafeResetDatabase() call. App should not hold onto subscriptions or Watermelon objects while resetting database.',
      )

      // check that subscriber was killed
      await database.write(() => tasks.create())
      expect(subscriber2).toHaveBeenCalledTimes(0)
    })
    it.skip('Cancels withChangesForTables observation during reset', async () => {})
    it.skip('Cancels Collection change observation during reset', async () => {})
    it.skip('Cancels Collection experimental subscribers during reset', async () => {})
    it.skip('Cancels Model change observation during reset', async () => {})
    it.skip('Cancels Model experimental subscribers during reset', async () => {})
    it.skip('Cancels Query observation during reset', async () => {})
    it.skip('Cancels Query experimental subscribers during reset', async () => {})
    it.skip('Cancels Relation observation during reset', async () => {})
    it.skip('Cancels Relation experimental subscribers during reset', async () => {})
    it('Signals internally when database is being reset', async () => {
      const { database } = mockDatabase()

      expect(database._isBeingReset).toBe(false)
      const promise = database.write(() => database.unsafeResetDatabase())
      expect(database._isBeingReset).toBe(true)
      await promise
      expect(database._isBeingReset).toBe(false)

      // force reset to fail
      database.adapter.unsafeResetDatabase = async () => {
        throw new Error('forced')
      }
      const promise2 = database.write(() => database.unsafeResetDatabase())
      expect(database._isBeingReset).toBe(true)
      await expectToRejectWithMessage(promise2, 'forced')
      expect(database._isBeingReset).toBe(false)
    })
    it.skip('Disallows <many methods> calls during reset', async () => {})
    it.skip('Makes old Model objects unsable after reset', async () => {})
    it.skip('Makes old Query objects unsable after reset', async () => {})
    it.skip('Makes old Relation objects unsable after reset', async () => {})
    // TODO: Write a regression test for https://github.com/Nozbe/WatermelonDB/commit/237e041d0d8aa4b3529fbf522f8d29c776fd4c0e
  })

  describe('Database.batch()', () => {
    it('can batch records', async () => {
      let {
        database,
        // eslint-disable-next-line
        cloneDatabase,
        tasks: tasksCollection,
        comments: commentsCollection,
      } = mockDatabase()
      const adapterBatchSpy = jest.spyOn(database.adapter, 'batch')

      // m1, m2 will be used to test batch-updates
      const m1 = await database.write(() => tasksCollection.create())
      const m2 = await database.write(() => commentsCollection.create())

      // m3, m4 will be used to test batch-deletes
      const m3 = await database.write(() => tasksCollection.create())
      const m4 = await database.write(() => commentsCollection.create())

      const tasksCollectionObserver = jest.fn()
      tasksCollection.changes.subscribe(tasksCollectionObserver)

      const commentsCollectionObserver = jest.fn()
      commentsCollection.changes.subscribe(commentsCollectionObserver)

      // m5, m6 will be used to test batch-creates
      const m5 = tasksCollection.prepareCreate()
      const m6 = commentsCollection.prepareCreate()

      const recordObserver = jest.fn()
      m1.observe().subscribe(recordObserver)

      const batchPromise = database.write(() =>
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

      expect(m1._preparedState).toBe(null)
      expect(m2._preparedState).toBe(null)

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
      createdRecords.forEach((record) => {
        expect(record._preparedState).toBe(null)
        expect(record.collection._cache.get(record.id)).toBe(record)
      })

      expect(recordObserver).toHaveBeenCalledTimes(2)

      // simulate reload -- check if changes actually got saved
      database = await cloneDatabase()
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
      const { database, tasks: tasksCollection } = mockDatabase()
      const adapterBatchSpy = jest.spyOn(database.adapter, 'batch')

      const model = tasksCollection.prepareCreate()
      await database.write(() => database.batch(null, model, false, undefined))

      expect(adapterBatchSpy).toHaveBeenCalledTimes(1)
      expect(adapterBatchSpy).toHaveBeenLastCalledWith([['create', 'mock_tasks', model._raw]])
    })
    it(`can batch with an array passed as argument`, async () => {
      const { database, tasks: tasksCollection } = mockDatabase()
      const adapterBatchSpy = jest.spyOn(database.adapter, 'batch')

      const model = tasksCollection.prepareCreate()
      await database.write(() => database.batch([null, model, false, undefined]))

      expect(adapterBatchSpy).toHaveBeenCalledTimes(1)
      expect(adapterBatchSpy).toHaveBeenLastCalledWith([['create', 'mock_tasks', model._raw]])
    })
    it('throws error if attempting to batch records without a pending operation', async () => {
      const { database, tasks } = mockDatabase()
      const m1 = await database.write(() => tasks.create())

      await expectToRejectWithMessage(
        database.write(() => database.batch(m1)),
        'prepared create/update/delete',
      )
    })
    it('throws error if batch is called outside of a writer', async () => {
      const { database, tasks } = mockDatabase()

      await expectToRejectWithMessage(
        database.batch(tasks.prepareCreate(noop)),
        'can only be called from inside of a Writer',
      )
      await expectToRejectWithMessage(
        database.read(() => database.batch(tasks.prepareCreate(noop))),
        'can only be called from inside of a Writer',
      )

      // check if in writer is successful
      await database.write(() =>
        database.batch(
          tasks.prepareCreate((task) => {
            task.name = 'foo1'
          }),
        ),
      )
      const [task] = await tasks.query().fetch()
      expect(task.name).toBe('foo1')
    })
    it(`throws an error if invalid arguments`, async () => {
      const { database } = mockDatabase()
      await expectToRejectWithMessage(
        database.batch([], null),
        'batch should be called with a list',
      )
    })
  })

  describe('Observation', () => {
    it('implements withChangesForTables', async () => {
      const { database, projects, tasks, comments } = mockDatabase()

      const observer = jest.fn()
      database.withChangesForTables(['mock_projects', 'mock_tasks']).subscribe(observer)

      expect(observer).toHaveBeenCalledTimes(1)

      await database.write(() => projects.create())
      const m1 = await database.write(() => projects.create())
      const m2 = await database.write(() => tasks.create())
      const m3 = await database.write(() => comments.create())

      expect(observer).toHaveBeenCalledTimes(4)
      expect(observer).toHaveBeenCalledWith([{ record: m1, type: CollectionChangeTypes.created }])
      expect(observer).toHaveBeenLastCalledWith([
        { record: m2, type: CollectionChangeTypes.created },
      ])

      await database.write(async () => {
        await m1.update()
        await m2.update()
        await m3.update()
      })

      expect(observer).toHaveBeenCalledTimes(6)
      expect(observer).toHaveBeenLastCalledWith([
        { record: m2, type: CollectionChangeTypes.updated },
      ])

      await database.write(async () => {
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
      const { database, projects, tasks, comments } = mockDatabase()

      const subscriber1 = jest.fn()
      const unsubscribe1 = database.experimentalSubscribe([], subscriber1)

      await database.write(() => tasks.create())

      const subscriber2 = jest.fn()
      const unsubscribe2 = database.experimentalSubscribe(['mock_tasks'], subscriber2)

      const subscriber3 = jest.fn()
      const unsubscribe3 = database.experimentalSubscribe(
        ['mock_tasks', 'mock_projects'],
        subscriber3,
      )

      const p1 = await database.write(() => projects.create())
      await database.write(() => tasks.create())
      await database.write(() => comments.create())

      expect(subscriber1).toHaveBeenCalledTimes(0)
      expect(subscriber2).toHaveBeenCalledTimes(1)
      expect(subscriber3).toHaveBeenCalledTimes(2)
      expect(subscriber2).toHaveBeenLastCalledWith()

      await database.write(() =>
        database.batch(projects.prepareCreate(), projects.prepareCreate(), tasks.prepareCreate()),
      )

      expect(subscriber2).toHaveBeenCalledTimes(2)
      expect(subscriber3).toHaveBeenCalledTimes(3)

      await database.write(() => p1.update())

      expect(subscriber2).toHaveBeenCalledTimes(2)
      expect(subscriber3).toHaveBeenCalledTimes(4)

      unsubscribe1()
      unsubscribe2()

      await database.write(() =>
        database.batch(tasks.prepareCreate(), p1.prepareDestroyPermanently()),
      )

      expect(subscriber1).toHaveBeenCalledTimes(0)
      expect(subscriber2).toHaveBeenCalledTimes(2)
      expect(subscriber3).toHaveBeenCalledTimes(5)
      unsubscribe3()
    })
    it('unsubscribe can safely be called more than once', async () => {
      const { database, tasks } = mockDatabase()

      const subscriber1 = jest.fn()
      const unsubscribe1 = database.experimentalSubscribe(['mock_tasks'], subscriber1)
      expect(subscriber1).toHaveBeenCalledTimes(0)

      const unsubscribe2 = database.experimentalSubscribe(['mock_tasks'], () => {})
      unsubscribe2()
      unsubscribe2()

      await database.write(() => tasks.create())

      expect(subscriber1).toHaveBeenCalledTimes(1)
      unsubscribe1()
    })
    it(`can subscribe with the same subscriber multiple times`, async () => {
      const { database, tasks } = mockDatabase()

      const subscriber = jest.fn()
      const unsubscribe1 = database.experimentalSubscribe(['mock_tasks'], subscriber)

      await database.write(() => tasks.create())
      expect(subscriber).toHaveBeenCalledTimes(1)

      const unsubscribe2 = database.experimentalSubscribe(['mock_tasks'], subscriber)

      await database.write(() => tasks.create())
      expect(subscriber).toHaveBeenCalledTimes(3)
      unsubscribe2()
      unsubscribe2() // noop
      await database.write(() => tasks.create())
      expect(subscriber).toHaveBeenCalledTimes(4)
      unsubscribe1()
      await database.write(() => tasks.create())
      expect(subscriber).toHaveBeenCalledTimes(4)
    })
    it('has new objects cached before calling subscribers (regression test)', async () => {
      const { database, projects, tasks } = mockDatabase()

      const project = projects.prepareCreate()
      const task = tasks.prepareCreate((t) => {
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

      await database.write(() => database.batch(project, task))
      expect(observer).toHaveBeenCalledTimes(2)

      // check if task is already cached
      expect(await taskPromise).toBe(task)
    })
  })

  const delayPromise = () => new Promise((resolve) => setTimeout(resolve, 100))

  describe('Database readers/writers', () => {
    it('can execute a writer block', async () => {
      const { database } = mockDatabase()

      const action = jest.fn(() => Promise.resolve(true))
      await database.write(action)

      expect(action).toHaveBeenCalledTimes(1)
    })
    it('queues writers/readers', async () => {
      const { database } = mockDatabase()

      const actions = [jest.fn(delayPromise), jest.fn(delayPromise), jest.fn(delayPromise)]

      const promise0 = database.write(actions[0])
      database.read(actions[1])

      expect(actions[0]).toHaveBeenCalledTimes(1)
      expect(actions[1]).toHaveBeenCalledTimes(0)

      await promise0
      const promise2 = database.write(actions[2])

      expect(actions[0]).toHaveBeenCalledTimes(1)
      expect(actions[1]).toHaveBeenCalledTimes(0)
      expect(actions[2]).toHaveBeenCalledTimes(0)

      await promise2

      expect(actions[0]).toHaveBeenCalledTimes(1)
      expect(actions[1]).toHaveBeenCalledTimes(1)
      expect(actions[2]).toHaveBeenCalledTimes(1)

      // after queue is empty I can queue again and have result immediately
      const writer3 = jest.fn(async () => 42)
      const promise3 = database.write(writer3)
      expect(writer3).toHaveBeenCalledTimes(1)
      await promise3
    })
    it('returns value from reader/writer', async () => {
      const { database } = mockDatabase()
      expect(await database.write(async () => 42)).toBe(42)
      expect(await database.read(async () => 420)).toBe(420)
    })
    it('passes error from reader/writer', async () => {
      const { database } = mockDatabase()
      await expectToRejectWithMessage(
        database.write(async () => {
          throw new Error('test error')
        }),
        'test error',
      )
    })
    it(`can distinguish between writers and readers running`, async () => {
      const { db } = mockDatabase()
      const actions = [jest.fn(delayPromise), jest.fn(delayPromise), jest.fn(delayPromise)]

      const promise0 = db.write(actions[0])
      db.read(actions[1])
      expect(db._workQueue.isWriterRunning).toBe(true)

      await promise0
      const promise2 = db.write(actions[2])
      expect(db._workQueue.isWriterRunning).toBe(false)

      await promise2
      expect(db._workQueue.isWriterRunning).toBe(false)

      const promise3 = db.write(async () => 42)
      expect(db._workQueue.isWriterRunning).toBe(true)
      await promise3
      expect(db._workQueue.isWriterRunning).toBe(false)
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
      const promises = actions.map((action) =>
        database.write(action).then(
          // jest will automatically fail the test if a promise rejects even though we're testing it later
          (value) => ['value', value],
          (error) => ['error', error],
        ),
      )
      await promises[4]

      // after queue is empty I can queue again
      const action5 = jest.fn(async () => 42)
      const promise5 = database.read(action5)
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
        database.write(async () => {
          called += 1
        })

      await database.write(() => {
        subaction()
        return delayPromise() // don't await subaction, just see it will never be called
      })
      expect(called).toBe(0)
    })
    it(`can call readers with callReader`, async () => {
      const { db } = mockDatabase()

      const action1 = () => db.read(async () => 42)
      const action2 = () => db.read(async (reader) => reader.callReader(() => action1()))
      const action3 = () => db.read(async (reader) => reader.callReader(() => action2()))
      expect(await action3()).toBe(42)
    })
    it(`can call writers with callWriter`, async () => {
      const { db } = mockDatabase()

      const action0 = () => db.read(async () => 42)
      const action1 = () => db.write(async (writer) => writer.callReader(() => action0()))
      const action2 = () => db.write(async (writer) => writer.callWriter(() => action1()))
      const action3 = () => db.write(async (writer) => writer.subAction(() => action2()))
      expect(await action3()).toBe(42)
    })
    it(`cannot call writers from readers`, async () => {
      const { db } = mockDatabase()

      const writer = () => db.write(async () => 42)
      await expectToRejectWithMessage(
        db.read(async (reader) => reader.callWriter(() => writer())),
        'is not a function',
      )
      await expectToRejectWithMessage(
        db.read(async (reader) => reader.callReader(() => writer())),
        'Cannot call a writer block from a reader block',
      )
    })
    it('sub actions skip the line only once', async () => {
      const { db } = mockDatabase()

      let called1 = 0
      let called2 = 0

      const action1 = () =>
        db.write(async () => {
          called1 += 1
        })
      const action2 = () =>
        db.write(async () => {
          called2 += 1
        })
      await db.write((writer) => {
        writer.callWriter(() => action1())
        action2()
        return delayPromise() // don't await subaction, just see it will never be called
      })
      expect(called1).toBe(1)
      expect(called2).toBe(0)
    })
    it(`ensures that callReader/callWriter calls a reader/writer`, async () => {
      const { db } = mockDatabase()
      const expectError = (promise) =>
        expectToRejectWithMessage(
          promise,
          'callReader/callWriter call must call a reader/writer synchronously',
        )
      const action = () => db.write(async () => 42)
      await expectError(db.write(async (writer) => writer.callWriter(() => {})))
      await expectError(db.write(async (writer) => writer.callReader(() => {})))
      await expectError(db.read(async (reader) => reader.callReader(() => {})))
      await expectError(
        db.write(async (writer) =>
          writer.callWriter(async () => {
            await delayPromise()
            return action()
          }),
        ),
      )
    })
    it(`can batch from a writer interface`, async () => {
      const { db, tasks } = mockDatabase()
      const adapterBatchSpy = jest.spyOn(db.adapter, 'batch')

      let t1, t2
      await db.write(async (writer) => {
        t1 = await tasks.create()
        t2 = tasks.prepareCreate()
        await writer.batch(
          t2,
          t1.prepareUpdate(() => {}),
          null,
          false,
          undefined,
        )
      })

      expect(adapterBatchSpy).toHaveBeenCalledTimes(2)
      expect(adapterBatchSpy).toHaveBeenLastCalledWith([
        ['create', 'mock_tasks', t2._raw],
        ['update', 'mock_tasks', t1._raw],
      ])
    })
    it(`ensures that reader/writer interface is not used after block is done`, async () => {
      const { db } = mockDatabase()

      const sth = () => db.read(async () => 42)

      let saved
      const action0 = () =>
        db.write(async (writer) => {
          saved = writer
        })
      const promise = action0()
      saved.callReader(() => sth())
      saved.callWriter(() => sth())
      saved.subAction(() => sth())
      saved.batch()
      await promise

      const expectError = (work) =>
        expect(work).toThrow('Illegal call on a reader/writer that should no longer be running')
      expectError(() => saved.callReader(() => sth()))
      expectError(() => saved.callWriter(() => sth()))
      expectError(() => saved.subAction(() => sth()))
      expectError(() => saved.batch())

      db.write(async () => {})
      expectError(() => saved.callReader(() => sth()))
    })
    it('aborts all pending actions if database is reset', async () => {
      const { database } = mockDatabase()

      let promise1
      let promise2
      let promise3
      let dangerousActionsCalled = 0
      let safeActionsCalled = 0

      const manyActions = async () => {
        // this will be called before reset:
        promise1 = database.write(async () => 1)
        await promise1

        // this will be called after reset:
        promise2 = database.write(async () => {
          dangerousActionsCalled += 1
        })
        await promise2

        promise3 = database.read(async () => {
          dangerousActionsCalled += 1
        })
        await promise3
      }

      const promises = manyActions().catch((e) => e)
      await database.write(() => database.unsafeResetDatabase())

      // actions beyond unsafe reset should be successful
      await Promise.all([
        database.write(async () => {
          safeActionsCalled += 1
        }),
        database.read(async () => {
          safeActionsCalled += 1
        }),
      ])

      expect(await promises).toMatchObject({ message: expect.stringMatching('database was reset') })

      expect(await promise1).toBe(1)
      await expectToRejectWithMessage(promise2, 'database was reset')
      expect(promise3).toBe(undefined) // code will never reach this point
      expect(dangerousActionsCalled).toBe(0)
      expect(safeActionsCalled).toBe(2)
    })
  })
})
