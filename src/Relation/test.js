import { MockTask, MockProject, mockDatabase } from '__tests__/testModels'

import Relation from '.'

describe('watermelondb/Relation', () => {
  it('gets id', () => {
    const { tasksCollection } = mockDatabase()
    const primary = new MockTask(tasksCollection, { project_id: 's1' })

    const relation = new Relation(primary, 'mock_projects', 'project_id', { isImmutable: false })
    expect(relation.id).toBe('s1')

    primary._isEditing = true
    primary.projectId = 's2'
    expect(relation.id).toBe('s2')
  })

  it('sets id', () => {
    const { tasksCollection, projectsCollection } = mockDatabase()

    const primary = new MockTask(tasksCollection, { project_id: null })
    const secondary = new MockProject(projectsCollection, {
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
    const { tasksCollection, projectsCollection } = mockDatabase()
    const primary = new MockTask(tasksCollection, {})
    const secondary = new MockProject(projectsCollection, { id: 's1' })

    const relation = new Relation(primary, 'mock_projects', 'project_id', { isImmutable: false })
    primary._isEditing = true
    relation.set(secondary)

    expect(relation.id).toBe('s1')
  })

  it('allows setting id/record only on create/prepareCreate when immutable', async () => {
    const { tasksCollection, commentsCollection } = mockDatabase()

    const secondary = await tasksCollection.create(mock => {
      mock.name = 'foo'
    })

    const primary = await commentsCollection.create(mock => {
      mock.task.id = secondary.id
    })

    expect(primary.task.id).toBe(secondary.id)

    expect(() =>
      primary.prepareUpdate(mock => {
        mock.task.id = 'foo'
      }),
    ).toThrow()

    const secondary2 = await commentsCollection.create(mock => {
      mock.name = 'bar'
    })

    const primary2 = await commentsCollection.prepareCreate(mock => {
      mock.task.id = secondary.id
      expect(mock.task.id).toBe(secondary.id)
      mock.task.set(secondary2)
      expect(mock.task.id).toBe(secondary2.id)
    })

    expect(primary2.task.id).toBe(secondary2.id)
  })

  it('observers related record', async () => {
    const { tasksCollection, projectsCollection } = mockDatabase()

    const secondary = await projectsCollection.create(mock => {
      mock.name = 'foo'
    })

    const primary = await tasksCollection.create(mock => {
      mock.projectId = secondary.id
    })

    const relation = new Relation(primary, 'mock_projects', 'project_id', { isImmutable: false })

    const observer = jest.fn()
    const subscription = relation.observe().subscribe(observer)

    await new Promise(process.nextTick) // give time to propagate

    expect(observer).toBeCalledWith(secondary)

    await secondary.update(mock => {
      mock.name = 'bar'
    })

    expect(observer).toHaveBeenCalledTimes(2)
    subscription.unsubscribe()
  })

  it('returns current record', async () => {
    const { tasksCollection, projectsCollection } = mockDatabase()

    const secondary = await projectsCollection.create(mock => {
      mock.name = 'foo'
    })

    const primary = await tasksCollection.create(mock => {
      mock.projectId = secondary.id
    })

    const relation = new Relation(primary, 'mock_projects', 'project_id', { isImmutable: false })

    let currentRecord = await relation.current
    expect(currentRecord).toBe(secondary)

    const newSecondary = await projectsCollection.create(mock => {
      mock.name = 'bar'
    })

    primary.update(mock => {
      mock.projectId = newSecondary.id
    })

    currentRecord = await relation.current
    expect(currentRecord).toBe(newSecondary)
  })

  it('caches observable', () => {
    const { tasksCollection } = mockDatabase()
    const model = new MockTask(tasksCollection, {})
    const relation = new Relation(model, 't1', 'c1', { isImmutable: false })

    const observable1 = relation.observe()
    const observable2 = relation.observe()

    expect(observable1).toBe(observable2)
  })
})
