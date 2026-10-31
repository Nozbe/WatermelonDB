import { of, throwError } from 'rxjs'
import { MockTask, mockDatabase } from '../../__tests__/testModels'

import experimentalFailsafe from './index'
import relation from '../relation'
import immutableRelation from '../immutableRelation'

const makeProxy = (task, fallback) => {
  class TaskProxy {
    asModel = task

    @experimentalFailsafe(fallback)
    @relation('mock_projects', 'project_id')
    project

    @experimentalFailsafe(fallback)
    @immutableRelation('mock_project_sections', 'project_section_id')
    projectSection
  }
  return new TaskProxy()
}

describe('decorators/experimentalFailsafe', () => {
  it('marks relations as failsafe', () => {
    const { tasks } = mockDatabase()
    const proxy = makeProxy(new MockTask(tasks, { project_id: 'p1' }))
    expect(proxy.project._isFailsafe).toBe(true)
    expect(proxy.projectSection._isFailsafe).toBe(true)
    expect(new MockTask(tasks, {}).project._isFailsafe).toBe(false)
  })
  it('fetches missing related records as the fallback value', async () => {
    const { tasks, projects, db } = mockDatabase()
    const task = await db.write(() =>
      tasks.create((mock) => {
        mock.projectId = 'missing'
      }),
    )
    expect(await makeProxy(task).project.fetch()).toBe(undefined)
    expect(await makeProxy(task, 'fallback').project.fetch()).toBe('fallback')
    expect(await makeProxy(task).projectSection.fetch()).toBe(null) // null id

    const project = await db.write(() =>
      projects.create((mock) => {
        mock._raw.id = 'missing'
      }),
    )
    expect(await makeProxy(task).project.fetch()).toBe(project)
  })
  it('observes missing related records as the fallback value, and recovers', async () => {
    const { tasks, projects, db } = mockDatabase()
    const task = await db.write(() =>
      tasks.create((mock) => {
        mock.projectId = 'missing'
      }),
    )
    const proxy = makeProxy(task, 'fallback')

    const observer = jest.fn()
    const error = jest.fn()
    const complete = jest.fn()
    const subscription = proxy.project.observe().subscribe(observer, error, complete)
    await new Promise(process.nextTick)

    expect(observer).toHaveBeenCalledTimes(1)
    expect(observer).toHaveBeenLastCalledWith('fallback')

    // related record arrives later
    const project = await db.write(() =>
      projects.create((mock) => {
        mock._raw.id = 'missing'
      }),
    )
    expect(observer).toHaveBeenCalledTimes(2)
    expect(observer).toHaveBeenLastCalledWith(project)

    // ...and is deleted again
    await db.write(() => project.markAsDeleted())
    expect(observer).toHaveBeenCalledTimes(3)
    expect(observer).toHaveBeenLastCalledWith('fallback')

    // a null relation id still yields null, not the fallback
    await db.write(() =>
      task.update((mock) => {
        mock.projectId = null
      }),
    )
    expect(observer).toHaveBeenLastCalledWith(null)

    expect(error).toHaveBeenCalledTimes(0)
    expect(complete).toHaveBeenCalledTimes(0)
    subscription.unsubscribe()
  })
  it('observes missing immutable related records as the fallback value, and recovers', async () => {
    const { tasks, projectSections, db } = mockDatabase()
    const task = await db.write(() =>
      tasks.create((mock) => {
        mock._setRaw('project_section_id', 'missing')
      }),
    )
    const proxy = makeProxy(task)

    const observer = jest.fn()
    const subscription = proxy.projectSection.observe().subscribe(observer)
    await new Promise(process.nextTick)
    expect(observer).toHaveBeenLastCalledWith(undefined)

    const section = await db.write(() =>
      projectSections.create((mock) => {
        mock._raw.id = 'missing'
      }),
    )
    expect(observer).toHaveBeenLastCalledWith(section)
    subscription.unsubscribe()
  })
  it('observes an immutable relation with a null id as null, not the fallback', async () => {
    const { tasks, db } = mockDatabase()
    const task = await db.write(() => tasks.create())
    const proxy = makeProxy(task, 'fallback')

    const observer = jest.fn()
    const complete = jest.fn()
    proxy.projectSection.observe().subscribe(observer, undefined, complete)
    await new Promise(process.nextTick)

    expect(observer).toHaveBeenCalledTimes(1)
    expect(observer).toHaveBeenLastCalledWith(null)
  })
  it('still catches errors of arbitrary observable-like values', async () => {
    class Proxy {
      @experimentalFailsafe('fallback')
      get broken() {
        return {
          fetch: () => Promise.reject(new Error('nope')),
          observe: () => throwError(() => new Error('nope')),
        }
      }

      @experimentalFailsafe('fallback')
      get working() {
        return {
          fetch: () => Promise.resolve('value'),
          observe: () => of('value'),
        }
      }
    }
    const proxy = new Proxy()

    expect(await proxy.broken.fetch()).toBe('fallback')
    expect(await proxy.working.fetch()).toBe('value')

    const observer = jest.fn()
    proxy.broken.observe().subscribe(observer)
    expect(observer).toHaveBeenLastCalledWith('fallback')
    proxy.working.observe().subscribe(observer)
    expect(observer).toHaveBeenLastCalledWith('value')
  })
})
