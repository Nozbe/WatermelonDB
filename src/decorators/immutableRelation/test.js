import { MockComment, mockDatabase } from '../../__tests__/testModels'

import Relation from '../../Relation'

describe('watermelondb/decorators/immutableRelation', () => {
  it('creates immutable Relation object', () => {
    const { comments } = mockDatabase()
    const primary = new MockComment(comments, { task_id: 's1' })

    const relation = primary.task
    expect(relation).toEqual(new Relation(primary, 'mock_tasks', 'task_id', { isImmutable: true }))
  })
})
