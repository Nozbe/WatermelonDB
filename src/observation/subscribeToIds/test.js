import * as Q from '../../QueryDescription'
import { mockDatabase } from '../../__tests__/testModels'
import subscribeToIds from './index'

const prepareTask = (tasks, { id, isCompleted, position }) =>
  tasks.prepareCreate((mock) => {
    mock._raw.id = id
    mock.position = position
    mock.isCompleted = isCompleted
  })

const createTask = async (tasks, { id, isCompleted, position }) => {
  const task = prepareTask(tasks, { id, isCompleted, position })
  await tasks.database.batch(task)
  return task
}

const updateTask = (task, updater) => task.collection.database.write(() => task.update(updater))

describe('subscribeToIds', () => {
  it('observes changes to ids', async () => {
    const { db, tasks } = mockDatabase()

    const query = tasks.query(Q.where('is_completed', true), Q.sortBy('position'))

    // start observing
    const observer = jest.fn()
    const unsubscribe = subscribeToIds(query, observer)

    const waitForNextQuery = () => tasks.query().fetch()
    await waitForNextQuery() // wait for initial query to go through

    expect(observer).toHaveBeenCalledTimes(1)
    expect(observer).toHaveBeenLastCalledWith([])

    // add matching model
    const t1 = await db.write(() => createTask(tasks, { id: 'a', isCompleted: true, position: 1 }))

    await waitForNextQuery()
    expect(observer).toHaveBeenCalledTimes(2)
    expect(observer).toHaveBeenLastCalledWith(['a'])

    // add many matching models
    let t2
    let t3
    await db.write(() => {
      t2 = prepareTask(tasks, { id: 'b', isCompleted: true, position: 2 })
      t3 = prepareTask(tasks, { id: 'c', isCompleted: true, position: 3 })
      return db.batch(t2, t3)
    })

    await waitForNextQuery()
    expect(observer).toHaveBeenCalledTimes(3)
    expect(observer).toHaveBeenLastCalledWith(['a', 'b', 'c'])

    // position chagne
    await updateTask(t2, () => {
      t2.position = 44
    })

    await waitForNextQuery()
    expect(observer).toHaveBeenCalledTimes(4)
    expect(observer).toHaveBeenLastCalledWith(['a', 'c', 'b'])

    // irrelevant chagne
    await updateTask(t2, () => {
      t2.name = 'hello'
    })

    await waitForNextQuery()
    expect(observer).toHaveBeenCalledTimes(4)
    expect(observer).toHaveBeenLastCalledWith(['a', 'c', 'b'])

    // remove some
    await db.write(() => t2.destroyPermanently())

    await waitForNextQuery()
    expect(observer).toHaveBeenCalledTimes(5)
    expect(observer).toHaveBeenLastCalledWith(['a', 'c'])

    // change to no longer match
    await updateTask(t1, () => {
      t1.isCompleted = false
    })

    await waitForNextQuery()
    expect(observer).toHaveBeenCalledTimes(6)
    expect(observer).toHaveBeenLastCalledWith(['c'])

    // ensure record subscriptions are disposed properly
    unsubscribe()
    await updateTask(t3, () => {
      t3.isCompleted = false
    })
    expect(observer).toHaveBeenCalledTimes(6)
  })
})
