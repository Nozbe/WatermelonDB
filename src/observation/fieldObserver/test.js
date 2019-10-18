import { Subject } from 'rxjs/Subject'
import { mockDatabase } from '../../__tests__/testModels'
import * as Q from '../../QueryDescription'
import fieldObserver from './index'

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
  it('observes changes correctly - simulated', async () => {
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
  it('observes changes correctly - test with simple observer', async () => {
    const { database, tasks } = mockDatabase({ actionsEnabled: true })

    // start observing
    const observer = jest.fn()
    const source = tasks.query(Q.where('is_completed', true)).observe()
    const subscription = fieldObserver(source, ['is_completed']).subscribe(observer)

    await tasks.query().fetch() // force query to go through

    expect(observer).toHaveBeenCalledWith([])
    expect(observer).toHaveBeenCalledTimes(1)

    // make some models
    let m1
    let m2
    await database.action(async () => {
      m1 = prepareTask(tasks, 'name1', true, 10)
      m2 = prepareTask(tasks, 'name2', true, 20)
      await database.batch(m1, prepareTask(tasks, 'name_irrelevant', false, 30), m2)
    })

    expect(observer).toHaveBeenCalledWith([m1, m2])
    expect(observer).toHaveBeenCalledTimes(2)

    // add matching model
    const m3 = await database.action(() => createTask(tasks, 'name3', true, 30))

    expect(observer).toHaveBeenCalledWith([m1, m2, m3])
    expect(observer).toHaveBeenCalledTimes(3)

    // remove matching model
    await database.action(() => m1.markAsDeleted())

    expect(observer).toHaveBeenCalledWith([m2, m3])
    expect(observer).toHaveBeenCalledTimes(4)

    // change model to no longer match
    // make sure changed model isn't re-emitted before source query removes it
    await updateTask(m2, task => {
      task.isCompleted = false
    })

    expect(observer).toHaveBeenCalledWith([m3])
    expect(observer).toHaveBeenCalledTimes(5)

    subscription.unsubscribe()

    expect(observer).toHaveBeenCalledTimes(5)
  })
})
