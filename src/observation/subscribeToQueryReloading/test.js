import { mockDatabase } from '../../__tests__/testModels'
import * as Q from '../../QueryDescription'
import subscribeToQueryReloading from './index'

const prepareTask = (tasks, name, isCompleted) =>
  tasks.prepareCreate((mock) => {
    mock.name = name
    mock.isCompleted = isCompleted
    mock.project.id = 'MOCK_PROJECT'
  })

const createTask = async (tasks, name, isCompleted) => {
  const task = prepareTask(tasks, name, isCompleted)
  await tasks.database.batch(task)
  return task
}

const updateTask = (task, updater) => task.collection.database.write(() => task.update(updater))

describe('subscribeToQueryReloading', () => {
  it('observes changes to query', async () => {
    const { database, tasks, projects } = mockDatabase()

    const query = tasks.query(
      Q.where('is_completed', true),
      Q.on('mock_projects', Q.where('name', 'hello')),
    )

    // preparation - create mock project
    let project
    let m1
    let m2
    let m3
    await database.write(() => {
      project = projects.prepareCreateFromDirtyRaw({ id: 'MOCK_PROJECT', name: 'hello' })
      m1 = prepareTask(tasks, 'name1', true)
      m2 = prepareTask(tasks, 'name2', true)
      m3 = prepareTask(tasks, 'name3', false)
      return database.batch(project, m1, m2, m3)
    })

    // start observing
    const observer = jest.fn()
    const unsubscribe = subscribeToQueryReloading(query, observer)

    const waitForNextQuery = () => tasks.query().fetch()
    await waitForNextQuery() // wait for initial query to go through

    expect(observer).toHaveBeenCalledTimes(1)
    expect(observer).toHaveBeenLastCalledWith([m1, m2])

    // add matching model
    const m4 = await database.write(() => createTask(tasks, 'name4', true))
    await waitForNextQuery()
    expect(observer).toHaveBeenCalledTimes(2)
    expect(observer).toHaveBeenLastCalledWith([m1, m2, m4])

    // remove matching model
    await database.write(() => m1.markAsDeleted())

    await waitForNextQuery()
    expect(observer).toHaveBeenCalledTimes(3)
    expect(observer).toHaveBeenLastCalledWith([m2, m4])

    // some irrelevant change (no emission)
    await updateTask(m2, (task) => {
      task.name = 'changed name'
    })
    await waitForNextQuery()
    expect(observer).toHaveBeenCalledTimes(3)

    // change model in other table
    await database.write(() =>
      project.update(() => {
        project.name = 'other'
      }),
    )

    await waitForNextQuery()
    expect(observer).toHaveBeenCalledTimes(4)
    expect(observer).toHaveBeenLastCalledWith([])

    // ensure record subscriptions are disposed properly
    unsubscribe()
    await database.write(() =>
      project.update(() => {
        project.name = 'hello'
      }),
    )
    expect(observer).toHaveBeenCalledTimes(4)
  })
  it('calls observer even if query is empty (regression)', async () => {
    const { tasks } = mockDatabase()

    const observer = jest.fn()
    const unsubscribe = subscribeToQueryReloading(tasks.query(), observer)

    const waitForNextQuery = () => tasks.query().fetch()
    await waitForNextQuery() // wait for initial query to go through

    expect(observer).toHaveBeenCalledTimes(1)
    expect(observer).toHaveBeenLastCalledWith([])
    unsubscribe()
  })
})
