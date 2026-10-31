import { MockTask, MockProject, mockDatabase } from '../__tests__/testModels'

import Relation from './index'

describe('Relation', () => {
  it('gets id', () => {
    const { tasks } = mockDatabase()
    const primary = new MockTask(tasks, { project_id: 's1' })

    const relation = new Relation(primary, 'mock_projects', 'project_id', { isImmutable: false })
    expect(relation.id).toBe('s1')

    primary._isEditing = true
    primary.projectId = 's2'
    expect(relation.id).toBe('s2')
  })
  it('sets id', () => {
    const { tasks, projects } = mockDatabase()

    const primary = new MockTask(tasks, { project_id: null })
    const secondary = new MockProject(projects, {
      id: 's1',
    })

    const relation = new Relation(primary, 'mock_projects', 'project_id', { isImmutable: false })

    expect(relation.id).toBe(null)
    primary._isEditing = true
    relation.id = secondary.id
    expect(relation.id).toBe('s1')
    expect(primary.projectId).toBe('s1')
  })
  it('sets record', () => {
    const { tasks, projects } = mockDatabase()
    const primary = new MockTask(tasks, {})
    const secondary = new MockProject(projects, { id: 's1' })

    const relation = new Relation(primary, 'mock_projects', 'project_id', { isImmutable: false })
    primary._isEditing = true
    relation.set(secondary)

    expect(relation.id).toBe('s1')
  })
  it('allows setting id/record only on create/prepareCreate when immutable', async () => {
    const { tasks, comments, db } = mockDatabase()

    const secondary = await db.write(() =>
      tasks.create((mock) => {
        mock.name = 'foo'
      }),
    )
    const primary = await db.write(() =>
      comments.create((mock) => {
        mock.task.id = secondary.id
      }),
    )

    expect(primary.task.id).toBe(secondary.id)

    expect(() =>
      primary.prepareUpdate((mock) => {
        mock.task.id = 'foo'
      }),
    ).toThrow()

    const secondary2 = await db.write(() =>
      comments.create((mock) => {
        mock.name = 'bar'
      }),
    )

    const primary2 = comments.prepareCreate((mock) => {
      mock.task.id = secondary.id
      expect(mock.task.id).toBe(secondary.id)
      mock.task.set(secondary2)
      expect(mock.task.id).toBe(secondary2.id)
    })

    expect(primary2.task.id).toBe(secondary2.id)
  })
  it('observers related record', async () => {
    const { tasks, projects, db } = mockDatabase()

    const secondary = await db.write(() =>
      projects.create((mock) => {
        mock.name = 'foo'
      }),
    )
    const primary = await db.write(() =>
      tasks.create((mock) => {
        mock.projectId = secondary.id
      }),
    )

    const relation = new Relation(primary, 'mock_projects', 'project_id', { isImmutable: false })

    const observer = jest.fn()
    const subscription = relation.observe().subscribe(observer)

    await new Promise(process.nextTick) // give time to propagate

    expect(observer).toHaveBeenCalledWith(secondary)

    await db.write(() =>
      secondary.update((mock) => {
        mock.name = 'bar'
      }),
    )

    expect(observer).toHaveBeenCalledTimes(2)
    subscription.unsubscribe()
  })
  it('fetches current record', async () => {
    const { tasks, projects, db } = mockDatabase()

    const secondary = await db.write(() =>
      projects.create((mock) => {
        mock.name = 'foo'
      }),
    )
    const primary = await db.write(() =>
      tasks.create((mock) => {
        mock.projectId = secondary.id
      }),
    )

    const relation = new Relation(primary, 'mock_projects', 'project_id', { isImmutable: false })

    let currentRecord = await relation.fetch()
    expect(currentRecord).toBe(secondary)

    const newSecondary = await db.write(() =>
      projects.create((mock) => {
        mock.name = 'bar'
      }),
    )

    db.write(() =>
      primary.update((mock) => {
        mock.projectId = newSecondary.id
      }),
    )

    currentRecord = await relation.fetch()
    expect(currentRecord).toBe(newSecondary)

    // test thenable syntax
    expect(await relation).toBe(currentRecord)
    expect(await relation.then((model) => [model])).toEqual([currentRecord])
  })
  it('errors when observing a related record that does not exist', async () => {
    const { tasks, db } = mockDatabase()
    const primary = await db.write(() =>
      tasks.create((mock) => {
        mock.projectId = 'missing'
      }),
    )
    const relation = new Relation(primary, 'mock_projects', 'project_id', { isImmutable: false })

    const observer = jest.fn()
    const error = jest.fn()
    relation.observe().subscribe(observer, error)
    await new Promise(process.nextTick)

    expect(observer).toHaveBeenCalledTimes(0)
    expect(error).toHaveBeenCalledTimes(1)
  })
  it('observes a missing related record as null when failsafe, and recovers', async () => {
    const { tasks, projects, db } = mockDatabase()
    const primary = await db.write(() =>
      tasks.create((mock) => {
        mock.projectId = 'missing'
      }),
    )
    const relation = new Relation(primary, 'mock_projects', 'project_id', {
      isImmutable: false,
      failsafe: true,
    })
    expect(relation._isFailsafe).toBe(true)

    const observer = jest.fn()
    const error = jest.fn()
    const complete = jest.fn()
    const subscription = relation.observe().subscribe(observer, error, complete)
    await new Promise(process.nextTick)

    expect(observer).toHaveBeenCalledTimes(1)
    expect(observer).toHaveBeenLastCalledWith(null)

    // related record arrives later (e.g. via sync)
    const secondary = await db.write(() =>
      projects.create((mock) => {
        mock._raw.id = 'missing'
        mock.name = 'foo'
      }),
    )
    expect(observer).toHaveBeenCalledTimes(2)
    expect(observer).toHaveBeenLastCalledWith(secondary)

    await db.write(() =>
      secondary.update((mock) => {
        mock.name = 'bar'
      }),
    )
    expect(observer).toHaveBeenCalledTimes(3)
    expect(observer).toHaveBeenLastCalledWith(secondary)

    // related record is deleted
    await db.write(() => secondary.markAsDeleted())
    expect(observer).toHaveBeenCalledTimes(4)
    expect(observer).toHaveBeenLastCalledWith(null)

    // relation is re-pointed at another record
    const secondary2 = await db.write(() => projects.create())
    await db.write(() =>
      primary.update((mock) => {
        mock.projectId = secondary2.id
      }),
    )
    expect(observer).toHaveBeenLastCalledWith(secondary2)

    expect(error).toHaveBeenCalledTimes(0)
    expect(complete).toHaveBeenCalledTimes(0)
    subscription.unsubscribe()
  })
  it('observes a missing immutable related record as null when failsafe, and recovers', async () => {
    const { tasks, comments, db } = mockDatabase()
    const primary = await db.write(() =>
      comments.create((mock) => {
        mock.task.id = 'missing'
      }),
    )
    const relation = new Relation(primary, 'mock_tasks', 'task_id', {
      isImmutable: true,
      failsafe: true,
    })

    const observer = jest.fn()
    const subscription = relation.observe().subscribe(observer)
    await new Promise(process.nextTick)
    expect(observer).toHaveBeenLastCalledWith(null)

    const secondary = await db.write(() =>
      tasks.create((mock) => {
        mock._raw.id = 'missing'
      }),
    )
    expect(observer).toHaveBeenLastCalledWith(secondary)
    subscription.unsubscribe()
  })
  it('observes a failsafe immutable relation with a null id as null', async () => {
    const { tasks, db } = mockDatabase()
    const primary = await db.write(() => tasks.create())
    const relation = new Relation(primary, 'mock_project_sections', 'project_section_id', {
      isImmutable: true,
      failsafe: true,
    })
    expect(relation.id).toBe(null)

    const observer = jest.fn()
    const error = jest.fn()
    relation.observe().subscribe(observer, error)
    await new Promise(process.nextTick)

    expect(observer).toHaveBeenCalledTimes(1)
    expect(observer).toHaveBeenLastCalledWith(null)
    expect(error).toHaveBeenCalledTimes(0)
  })
  it('caches observable', () => {
    const { tasks } = mockDatabase()
    const model = new MockTask(tasks, {})
    const relation = new Relation(model, 't1', 'c1', { isImmutable: false })

    const observable1 = relation.observe()
    const observable2 = relation.observe()

    expect(observable1).toBe(observable2)
  })
  it(`has wmelon tag`, () => {
    const { tasks } = mockDatabase()
    const model = new MockTask(tasks, {})
    const relation = new Relation(model, 't1', 'c1', { isImmutable: false })
    expect(relation.constructor._wmelonTag).toBe('relation')
  })
})
