import { isChangeSetEmpty, resolveConflict } from '../helpers'
import { emptyChangeSet, makeChangeSet } from './helpers'

describe('resolveConflict', () => {
  it('can resolve per-column conflicts', () => {
    expect(
      resolveConflict(
        { col1: 'a', col2: true, col3: 10, _status: 'updated', _changed: 'col2' },
        { col1: 'b', col2: false, col3: 10 },
      ),
    ).toEqual({ _status: 'updated', _changed: 'col2', col1: 'b', col2: true, col3: 10 })
    expect(
      resolveConflict(
        { col1: 'a', col2: true, col3: 20, _status: 'updated', _changed: 'col2,col3' },
        { col1: 'b', col2: false, col3: 10 },
      ),
    ).toEqual({ _status: 'updated', _changed: 'col2,col3', col1: 'b', col2: true, col3: 20 })
  })
  it('ignores missing remote columns', () => {
    expect(
      resolveConflict(
        { col1: 'a', col2: true, col3: 20, _status: 'updated', _changed: 'col2' },
        { col2: false },
      ),
    ).toEqual({ _status: 'updated', _changed: 'col2', col1: 'a', col2: true, col3: 20 })
  })
})

describe('isChangeSetEmpty', () => {
  it('empty changeset is empty', () => {
    expect(isChangeSetEmpty(emptyChangeSet)).toBe(true)
    expect(isChangeSetEmpty({})).toBe(true)
  })
  it('just one change is enough to dirty the changeset', () => {
    expect(
      isChangeSetEmpty(
        makeChangeSet({
          mock_projects: { created: [{ id: 'foo' }] },
        }),
      ),
    ).toBe(false)
    expect(
      isChangeSetEmpty(
        makeChangeSet({
          mock_tasks: { updated: [{ id: 'foo' }] },
        }),
      ),
    ).toBe(false)
    expect(
      isChangeSetEmpty(
        makeChangeSet({
          mock_comments: { deleted: ['foo'] },
        }),
      ),
    ).toBe(false)
  })
})
