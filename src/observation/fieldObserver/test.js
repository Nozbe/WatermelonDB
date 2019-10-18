import { Subject } from 'rxjs/Subject'
import { mockDatabase } from '../../__tests__/testModels'
import * as Q from '../../QueryDescription'
import fieldObserver from './index'
import simpleObserver from '../simpleObserver'
import { reloadingObserverWithStatus } from '../reloadingObserver'

const prepareTask = (tasks, name, isCompleted, position) =>
  tasks.prepareCreate(mock => {
    mock.name = name
    mock.isCompleted = isCompleted
    mock.position = position
  })

const createTask = async (tasks, name, isCompleted, position) => {
  const task = prepareTask(tasks, name, isCompleted, position)
  await tasks.database.batch(task)
  return task
}

const updateTask = (task, updater) => task.collection.database.action(() => task.update(updater))

describe('fieldObserver', () => {
  it('observes changes correctly - simulated unit test', async () => {
    const { database, tasks } = mockDatabase({ actionsEnabled: true })

    // start observing
    const source = new Subject()
    const observer = jest.fn()
    const subscription = fieldObserver(source, ['is_completed', 'position']).subscribe(observer)

    // start with a few matching models
    let m1
    let m2
    await database.action(async () => {
      m1 = await createTask(tasks, 'name1', false, 10)
      m2 = await createTask(tasks, 'name2', false, 20)
    })
    source.next([m1, m2])
    expect(observer).toHaveBeenCalledWith([m1, m2])
    expect(observer).toHaveBeenCalledTimes(1)

    // add matches, remove matches
    const m3 = await database.action(() => createTask(tasks, 'name3', false, 30))
    source.next([m2, m3])
    expect(observer).toHaveBeenCalledWith([m2, m3])
    expect(observer).toHaveBeenCalledTimes(2)

    // make some irrelevant changes (no emission)
    await updateTask(m3, mock => {
      mock.name = 'changed name'
    })
    expect(observer).toHaveBeenCalledTimes(2)

    // change a relevant field
    await updateTask(m3, mock => {
      mock.position += 1
    })
    expect(observer).toHaveBeenCalledWith([m2, m3])
    expect(observer).toHaveBeenCalledTimes(3)

    // change another relevant field
    await updateTask(m2, mock => {
      mock.isCompleted = true
    })

    expect(observer).toHaveBeenCalledWith([m2, m3])
    expect(observer).toHaveBeenCalledTimes(4)

    // change a relevant field in a previously-observed record (no emission)
    await updateTask(m1, mock => {
      mock.position += 1
    })
    expect(observer).toHaveBeenCalledTimes(4)

    // ensure record subscriptions are disposed properly
    source.complete()
    await updateTask(m2, mock => {
      mock.position += 1
    })
    await updateTask(m3, mock => {
      mock.position += 1
    })
    subscription.unsubscribe()
    expect(observer).toHaveBeenCalledTimes(4)
  })
  async function fullObservationTest(mockDb, source, asyncObserver) {
    const { database, tasks } = mockDb

    // start observing
    const observer = jest.fn()
    const subscription = fieldObserver(source, ['is_completed']).subscribe(observer)

    const waitForNextQuery = () => tasks.query().fetch()
    await waitForNextQuery() // wait for initial query to go through

    expect(observer).toHaveBeenCalledTimes(1)
    expect(observer).toHaveBeenCalledWith([])

    // make some models
    let m1
    let m2
    await database.action(async () => {
      m1 = prepareTask(tasks, 'name1', true, 10)
      m2 = prepareTask(tasks, 'name2', true, 20)
      await database.batch(m1, prepareTask(tasks, 'name_irrelevant', false, 30), m2)
    })

    asyncObserver && (await waitForNextQuery())
    expect(observer).toHaveBeenCalledTimes(2)
    expect(observer).toHaveBeenCalledWith([m1, m2])

    // add matching model
    const m3 = await database.action(() => createTask(tasks, 'name3', true, 30))

    asyncObserver && (await waitForNextQuery())
    expect(observer).toHaveBeenCalledTimes(3)
    expect(observer).toHaveBeenCalledWith([m1, m2, m3])

    // remove matching model
    await database.action(() => m1.markAsDeleted())

    asyncObserver && (await waitForNextQuery())
    expect(observer).toHaveBeenCalledTimes(4)
    expect(observer).toHaveBeenCalledWith([m2, m3])

    // change model to no longer match
    // make sure changed model isn't re-emitted before source query removes it
    await updateTask(m2, task => {
      task.isCompleted = false
    })

    asyncObserver && (await waitForNextQuery())
    expect(observer).toHaveBeenCalledTimes(5)
    expect(observer).toHaveBeenCalledWith([m3])

    subscription.unsubscribe()

    expect(observer).toHaveBeenCalledTimes(5)
  }
  it('observes changes correctly - test with simple observer', async () => {
    const mockDb = mockDatabase({ actionsEnabled: true })
    const query = mockDb.tasks.query(Q.where('is_completed', true))
    const source = simpleObserver(query)
    await fullObservationTest(mockDb, source)
  })
  it('observes changes correctly - test with reloading observer', async () => {
    const mockDb = mockDatabase({ actionsEnabled: true })
    const query = mockDb.tasks.query(Q.where('is_completed', true))
    const source = reloadingObserverWithStatus(query)
    await fullObservationTest(mockDb, source, true)
    // TODO: Move these to Collection, test for distinctUntilChanged
  })
})
