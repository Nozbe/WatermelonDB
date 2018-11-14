import clone from 'lodash.clonedeep'
import { mockDatabase } from '../__tests__/testModels'

import { fetchLocalChanges, markLocalChangesAsSynced } from './index'
import { addToRawSet, setRawColumnChange } from './helpers'
import { resolveConflict, prepareCreateFromRaw } from './syncHelpers'

describe('addToRawSet', () => {
  it('transforms raw set', () => {
    expect(addToRawSet('', 'foo')).toBe('foo')
    expect(addToRawSet('foo', 'bar')).toBe('foo,bar')
    expect(addToRawSet('foo,bar', 'baz')).toBe('foo,bar,baz')
    expect(addToRawSet('foo,bar', 'foo')).toBe('foo,bar')
    expect(addToRawSet('foo,bar', 'bar')).toBe('foo,bar')
    expect(addToRawSet(null, 'bar')).toBe('bar')
  })
})

describe('setRawColumnChange', () => {
  it('adds to _changed if needed', () => {
    const test = (input, column, output) => {
      const raw = { ...input }
      setRawColumnChange(raw, column)
      expect(raw).toEqual(output)
    }
    test({ _status: 'synced', _changed: '' }, 'foo', { _status: 'updated', _changed: 'foo' })
    test({ _status: 'created', _changed: '' }, 'foo', { _status: 'created', _changed: '' })
    test({ _status: 'updated', _changed: '' }, 'foo', { _status: 'updated', _changed: 'foo' })
    test({ _status: 'updated', _changed: 'foo,bar' }, 'bar', {
      _status: 'updated',
      _changed: 'foo,bar',
    })
  })
})

describe('Conflict resolution', () => {
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
})

const emptyLocalChanges = Object.freeze({
  mock_projects: { created: [], updated: [], deleted: [] },
  mock_tasks: { created: [], updated: [], deleted: [] },
  mock_comments: { created: [], updated: [], deleted: [] },
})

const makeLocalChanges = async mock => {
  const { database, projectsCollection, tasksCollection, commentsCollection } = mock

  // create records
  const p1created = prepareCreateFromRaw(projectsCollection, {})
  const p2created = prepareCreateFromRaw(projectsCollection, {})
  const p3updated = prepareCreateFromRaw(projectsCollection, {
    id: 'updated1',
    _status: 'synced',
  })
  const p4deleted = prepareCreateFromRaw(projectsCollection, {})
  const t1created = prepareCreateFromRaw(tasksCollection, {})
  const t2deleted = prepareCreateFromRaw(tasksCollection, { id: 'tsynced1', _status: 'synced' })
  const c1created = prepareCreateFromRaw(commentsCollection, {})
  const c2destroyed = prepareCreateFromRaw(commentsCollection, {})

  await database.batch(
    p1created,
    p2created,
    prepareCreateFromRaw(projectsCollection, { _status: 'synced', id: 'synced1' }),
    p3updated,
    p4deleted,
    t1created,
    prepareCreateFromRaw(tasksCollection, { _status: 'synced', id: 'synced2' }),
    t2deleted,
    c1created,
    c2destroyed,
  )

  // update records
  await p3updated.update(p => {
    p.name = 'x'
  })
  await t2deleted.update(t => {
    t.name = 'yy'
  })

  // delete records
  await p4deleted.markAsDeleted()
  await t2deleted.markAsDeleted()
  await c2destroyed.destroyPermanently() // sanity check

  return {
    p1created,
    p2created,
    p3updated,
    p4deleted,
    t1created,
    t2deleted,
    c1created,
  }
}

describe('fetchLocalChanges', () => {
  it('returns empty object if no changes', async () => {
    const { database } = mockDatabase({ actionsEnabled: true })
    expect(await fetchLocalChanges(database)).toEqual(emptyLocalChanges)
  })
  it('fetches all local changes', async () => {
    const mock = mockDatabase()
    // eslint-disable-next-line
    let { database, cloneDatabase } = mock

    const {
      p1created,
      p2created,
      p3updated,
      p4deleted,
      t1created,
      t2deleted,
      c1created,
    } = await makeLocalChanges(mock)

    // check
    expect(p1created._raw._status).toBe('created')
    expect(p3updated._raw._status).toBe('updated')
    expect(p3updated._raw._changed).toBe('name')
    expect(t2deleted._raw._status).toBe('deleted')
    const expected = clone({
      mock_projects: {
        created: [p1created._raw, p2created._raw],
        updated: [p3updated._raw],
        deleted: [p4deleted.id],
      },
      mock_tasks: { created: [t1created._raw], updated: [], deleted: [t2deleted.id] },
      mock_comments: {
        created: [c1created._raw],
        updated: [],
        deleted: [],
      },
    })
    const result = await fetchLocalChanges(database)
    expect(result).toEqual(expected)

    // simulate reload
    database = cloneDatabase()
    expect(await fetchLocalChanges(database)).toEqual(expected)
  })
  it('returns object copies', async () => {
    const mock = mockDatabase()
    const { database } = mock

    const { p3updated } = await makeLocalChanges(mock)

    const result = await fetchLocalChanges(database)
    const resultCloned = clone(result)

    // raws should be cloned - further changes don't affect result
    await p3updated.update(p => {
      p.name = 'y'
    })
    expect(result).toEqual(resultCloned)
  })
})

describe('markLocalChangesAsSynced', () => {
  it('does nothing for empty local changes', async () => {
    const mock = mockDatabase()
    const { database } = mock

    await makeLocalChanges(mock)
    const localChanges1 = clone(await fetchLocalChanges(database))

    await markLocalChangesAsSynced(database, emptyLocalChanges)

    const localChanges2 = clone(await fetchLocalChanges(database))
    expect(localChanges1).toEqual(localChanges2)
  })
  it('marks local changes as synced', async () => {
    const mock = mockDatabase()
    const { database, adapter, projectsCollection, tasksCollection } = mock

    await makeLocalChanges(mock)

    const projectCount = await projectsCollection.query().fetchCount()
    const taskCount = await tasksCollection.query().fetchCount()

    const localChanges = await fetchLocalChanges(database)
    await markLocalChangesAsSynced(database, localChanges)

    // no more changes
    expect(await makeLocalChanges(mock)).toEqual(emptyLocalChanges)

    // still just as many objects
    const projects = await projectsCollection.query().fetch()
    const tasks = await tasksCollection.query().fetch()
    expect(projects.length).toBe(projectCount)
    expect(tasks.length).toBe(taskCount)

    // all objects marked as synced
    expect(projects.every(record => record.syncStatus === 'synced')).toBe(true)
    expect(tasks.every(record => record.syncStatus === 'synced')).toBe(true)

    // no objects marked as deleted
    expect(await adapter.getDeletedRecords('mock_projects')).toBe([])
    expect(await adapter.getDeletedRecords('mock_tasks')).toBe([])
    expect(await adapter.getDeletedRecords('mock_comments')).toBe([])
  })
  it.skip('only emits one collection batch change', async () => {
    // TODO
  })
  it.skip(`doesn't mark as synced records that changed since changes were fetched`, async () => {
    // TODO
  })
})
