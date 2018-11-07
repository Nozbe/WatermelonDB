import { MockTask, mockDatabase } from '../../__tests__/testModels'

import Relation from '../../Relation'

describe('watermelondb/decorators/relation', () => {
  it('creates Relation object', () => {
    const { tasksCollection } = mockDatabase()
    const primary = new MockTask(tasksCollection, { project_id: 's1' })

    const relation = primary.project
    expect(relation).toEqual(
      new Relation(primary, 'mock_projects', 'project_id', { isImmutable: false }),
    )
  })

  it('disallows to set relation directly', () => {
    const { tasksCollection } = mockDatabase()
    const primary = new MockTask(tasksCollection, { project_id: 's1' })

    expect(() => {
      primary.project = 'blah'
    }).toThrow()
  })

  it('caches Relation object', () => {
    const { tasksCollection } = mockDatabase()
    const primary = new MockTask(tasksCollection, { project_id: 's1' })

    const relation1 = primary.project
    const relation2 = primary.project
    expect(relation1).toBe(relation2)
  })
})
