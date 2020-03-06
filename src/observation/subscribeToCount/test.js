import { mockDatabase } from '../../__tests__/testModels'
import * as Q from '../../QueryDescription'
import subscribeToCount from './index'

const prepareTask = (tasks, isCompleted) =>
  tasks.prepareCreate(mock => {
    mock.isCompleted = isCompleted
  })

const createTask = async (tasks, isCompleted) => {
  const task = prepareTask(tasks, isCompleted)
  await tasks.database.batch(task)
  return task
}

const updateTask = (task, updater) => task.collection.database.action(() => task.update(updater))

describe('subscribeToCount', () => {
  it('observes changes to count', async () => {
    const { database, tasks } = mockDatabase({ actionsEnabled: true })

    const query = tasks.query(Q.where('is_completed', true))

    // start observing
    const observer = jest.fn()
    const unsubscribe = subscribeToCount(query, false, observer)

    const waitForNextQuery = () => tasks.query().fetch()
    await waitForNextQuery() // wait for initial query to go through

    expect(observer).toHaveBeenCalledTimes(1)
    expect(observer).toHaveBeenLastCalledWith(0)

    // add matching model
    const t1 = await database.action(() => createTask(tasks, true))

    await waitForNextQuery()
    expect(observer).toHaveBeenCalledTimes(2)
    expect(observer).toHaveBeenLastCalledWith(1)

    // add many
    let t2
    let t3
    await database.action(() => {
      t2 = prepareTask(tasks, true)
      t3 = prepareTask(tasks, true)
      return database.batch(t2, t3)
    })

    await waitForNextQuery()
    expect(observer).toHaveBeenCalledTimes(3)
    expect(observer).toHaveBeenLastCalledWith(3)

    // irrelevant chagne
    await updateTask(t2, () => {
      t2.name = 'hello'
    })

    await waitForNextQuery()
    expect(observer).toHaveBeenCalledTimes(3)

    // remove some
    await database.action(() => t2.destroyPermanently())

    await waitForNextQuery()
    expect(observer).toHaveBeenCalledTimes(4)
    expect(observer).toHaveBeenLastCalledWith(2)

    // change to no longer match
    await updateTask(t1, () => {
      t1.isCompleted = false
    })

    await waitForNextQuery()
    expect(observer).toHaveBeenCalledTimes(5)
    expect(observer).toHaveBeenLastCalledWith(1)

    // ensure record subscriptions are disposed properly
    unsubscribe()
    await updateTask(t3, () => {
      t3.isCompleted = false
    })
    expect(observer).toHaveBeenCalledTimes(5)
  })
})
