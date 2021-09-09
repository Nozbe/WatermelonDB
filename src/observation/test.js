import { mockDatabase } from '../__tests__/testModels'
import * as Q from '../QueryDescription'

import subscribeToQueryWithColumns from './subscribeToQueryWithColumns'
import subscribeToQuery from './subscribeToQuery'

const prepareTask = (tasks, name, isCompleted, position) =>
  tasks.prepareCreate((mock) => {
    mock.name = name
    mock.isCompleted = isCompleted
    mock.position = position
    mock.project.id = 'MOCK_PROJECT'
  })

const createTask = async (tasks, name, isCompleted, position) => {
  const task = prepareTask(tasks, name, isCompleted, position)
  await tasks.database.batch(task)
  return task
}

const updateTask = (task, updater) => task.collection.database.write(() => task.update(updater))

describe('common observation tests', () => {
  async function updatesListBeforeModelTest(mockDb, subscribe) {
    // If we observe a list of records, and then for each of them we observe the record
    // We must emit list changes first - otherwise, a change to a record that removes it from the list
    // will re-render its component unnecessarily before the whole list is re-rendered to remove it
    const { db, tasks, projects } = mockDb

    // create a task
    const task = await db.write(async () => {
      await db.batch(projects.prepareCreateFromDirtyRaw({ id: 'MOCK_PROJECT' }))
      return createTask(tasks, 'task', true, 30)
    })

    // start observing list
    const events = []
    const listObserver = jest.fn(() => events.push('list'))
    const listUnsubscribe = subscribe(listObserver)
    //

    const waitForNextQuery = () => tasks.query().fetch()
    await waitForNextQuery() // wait for initial query to go through
    expect(listObserver).toHaveBeenLastCalledWith([task])
    expect(events.join(',')).toBe('list')

    // start observing task (two ways)
    const taskObserver = jest.fn(() => events.push('task'))
    const taskUnsubsribe = task.experimentalSubscribe(taskObserver)

    const taskObserver2 = jest.fn(() => events.push('task2'))
    const taskUnsubsribe2 = task.observe().subscribe(taskObserver2)
    expect(events.join(',')).toBe('list,task2')

    // make a change removing from list
    await updateTask(task, () => {
      task.isCompleted = false
    })
    await waitForNextQuery()

    expect(listObserver).toHaveBeenLastCalledWith([])
    expect(events.join(',')).toBe('list,task2,list,task2,task')

    // clean up
    listUnsubscribe()
    taskUnsubsribe()
    taskUnsubsribe2.unsubscribe()
  }
  const simpleQuery = Q.where('is_completed', true)
  const complexQuery = [
    Q.where('is_completed', true),
    // fake query to force to use reloading observer
    Q.on('mock_projects', Q.where('id', Q.notEq(null))),
  ]
  it(`updates list before model - test with subscribeToSimpleQuery`, async () => {
    const mockDb = mockDatabase()
    await updatesListBeforeModelTest(mockDb, (observer) =>
      subscribeToQuery(mockDb.tasks.query(simpleQuery), observer),
    )
  })
  it(`updates list before model - test with reloadingObserver`, async () => {
    const mockDb = mockDatabase()
    await updatesListBeforeModelTest(mockDb, (observer) =>
      subscribeToQuery(mockDb.tasks.query(...complexQuery), observer),
    )
  })
  it(`updates list before model - test with subscribeToQueryWithColumns and simple observer`, async () => {
    const mockDb = mockDatabase()
    await updatesListBeforeModelTest(mockDb, (observer) =>
      subscribeToQueryWithColumns(mockDb.tasks.query(simpleQuery), ['position'], observer),
    )
  })
  it(`updates list before model - test with subscribeToQueryWithColumns and reloading observer`, async () => {
    const mockDb = mockDatabase()
    await updatesListBeforeModelTest(mockDb, (observer) =>
      subscribeToQueryWithColumns(mockDb.tasks.query(...complexQuery), ['position'], observer),
    )
  })
})
