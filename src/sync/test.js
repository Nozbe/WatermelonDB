import clone from 'lodash.clonedeep'
import { mockDatabase } from '../__tests__/testModels'

import { fetchLocalChanges, markLocalChangesAsSynced, applyRemoteChanges } from './index'
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

const emptyChangeSet = Object.freeze({
  mock_projects: { created: [], updated: [], deleted: [] },
  mock_tasks: { created: [], updated: [], deleted: [] },
  mock_comments: { created: [], updated: [], deleted: [] },
})

const makeLocalChanges = async mock => {
  const { database, projectsCollection, tasksCollection, commentsCollection } = mock

  // create records
  const pCreated1 = prepareCreateFromRaw(projectsCollection, { id: 'pCreated1' })
  const pCreated2 = prepareCreateFromRaw(projectsCollection, { id: 'pCreated2' })
  const pUpdated1 = prepareCreateFromRaw(projectsCollection, {
    id: 'pUpdated1',
    _status: 'synced',
  })
  const pDeleted1 = prepareCreateFromRaw(projectsCollection, { id: 'pDeleted1' })
  const tCreated1 = prepareCreateFromRaw(tasksCollection, { id: 'tCreated1' })
  const tDeleted1 = prepareCreateFromRaw(tasksCollection, { id: 'tDeleted1', _status: 'synced' })
  const cCreated1 = prepareCreateFromRaw(commentsCollection, { id: 'cCreated1' })
  const cDestroyed1 = prepareCreateFromRaw(commentsCollection, { id: 'cDestroyed1' })

  await database.batch(
    pCreated1,
    pCreated2,
    prepareCreateFromRaw(projectsCollection, { _status: 'synced', id: 'pSynced1' }),
    pUpdated1,
    pDeleted1,
    tCreated1,
    prepareCreateFromRaw(tasksCollection, { _status: 'synced', id: 'tSynced1' }),
    tDeleted1,
    cCreated1,
    cDestroyed1,
  )

  // update records
  await pUpdated1.update(p => {
    p.name = 'x'
  })
  await tDeleted1.update(t => {
    t.name = 'yy'
  })

  // delete records
  await pDeleted1.markAsDeleted()
  await tDeleted1.markAsDeleted()
  await cDestroyed1.destroyPermanently() // sanity check

  return {
    pCreated1,
    pCreated2,
    pUpdated1,
    pDeleted1,
    tCreated1,
    tDeleted1,
    cCreated1,
  }
}

describe('fetchLocalChanges', () => {
  it('returns empty object if no changes', async () => {
    const { database } = mockDatabase({ actionsEnabled: true })
    expect(await fetchLocalChanges(database)).toEqual({
      changes: emptyChangeSet,
      affectedRecords: [],
    })
  })
  it('fetches all local changes', async () => {
    const mock = mockDatabase()
    // eslint-disable-next-line
    let { database, cloneDatabase } = mock

    const {
      pCreated1,
      pCreated2,
      pUpdated1,
      pDeleted1,
      tCreated1,
      tDeleted1,
      cCreated1,
    } = await makeLocalChanges(mock)

    // check
    expect(pCreated1._raw._status).toBe('created')
    expect(pUpdated1._raw._status).toBe('updated')
    expect(pUpdated1._raw._changed).toBe('name')
    expect(tDeleted1._raw._status).toBe('deleted')
    const expectedChanges = clone({
      mock_projects: {
        created: [pCreated1._raw, pCreated2._raw],
        updated: [pUpdated1._raw],
        deleted: [pDeleted1.id],
      },
      mock_tasks: { created: [tCreated1._raw], updated: [], deleted: [tDeleted1.id] },
      mock_comments: {
        created: [cCreated1._raw],
        updated: [],
        deleted: [],
      },
    })
    const expectedAffectedRecords = [pCreated1, pCreated2, pUpdated1, tCreated1, cCreated1]
    const result = await fetchLocalChanges(database)
    expect(result.changes).toEqual(expectedChanges)
    expect(result.affectedRecords).toEqual(expectedAffectedRecords)

    // simulate reload
    database = cloneDatabase()
    const result2 = await fetchLocalChanges(database)
    expect(result2.changes).toEqual(expectedChanges)
    expect(result2.affectedRecords.map(r => r._raw)).toEqual(
      expectedAffectedRecords.map(r => r._raw),
    )
  })
  it('returns object copies', async () => {
    const mock = mockDatabase()
    const { database } = mock

    const { pUpdated1 } = await makeLocalChanges(mock)

    const { changes } = await fetchLocalChanges(database)
    const changesCloned = clone(changes)

    // raws should be cloned - further changes don't affect result
    await pUpdated1.update(p => {
      p.name = 'y'
    })
    expect(changes).toEqual(changesCloned)
  })
})

describe('markLocalChangesAsSynced', () => {
  it('does nothing for empty local changes', async () => {
    const mock = mockDatabase()
    const { database } = mock

    await makeLocalChanges(mock)
    const localChanges1 = await fetchLocalChanges(database)

    await markLocalChangesAsSynced(database, { changes: emptyChangeSet, affectedRecords: [] })

    const localChanges2 = await fetchLocalChanges(database)
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
    expect(await fetchLocalChanges(database)).toEqual({
      changes: emptyChangeSet,
      affectedRecords: [],
    })

    // still just as many objects
    const projects = await projectsCollection.query().fetch()
    const tasks = await tasksCollection.query().fetch()
    expect(projects.length).toBe(projectCount)
    expect(tasks.length).toBe(taskCount)

    // all objects marked as synced
    expect(projects.every(record => record.syncStatus === 'synced')).toBe(true)
    expect(tasks.every(record => record.syncStatus === 'synced')).toBe(true)

    // no objects marked as deleted
    expect(await adapter.getDeletedRecords('mock_projects')).toEqual([])
    expect(await adapter.getDeletedRecords('mock_tasks')).toEqual([])
    expect(await adapter.getDeletedRecords('mock_comments')).toEqual([])
  })
  it.skip('only emits one collection batch change', async () => {
    // TODO
  })
  it.skip(`doesn't mark as synced records that changed since changes were fetched`, async () => {
    // TODO
  })
})

describe('applyRemoteChanges', () => {
  it('does nothing if no remote changes', async () => {
    const mock = mockDatabase()
    const { database } = mock

    await makeLocalChanges(mock)
    const localChanges1 = await fetchLocalChanges(database)

    await applyRemoteChanges(database, emptyChangeSet)

    const localChanges2 = await fetchLocalChanges(database)
    expect(localChanges1).toEqual(localChanges2)
  })
  it('can apply remote changes successfully', async () => {
    const mock = mockDatabase()
    const { database, adapter, projectsCollection, tasksCollection } = mock

    // make a local mess first
    await makeLocalChanges(mock)

    // apply these changes from server
    const remoteChanges = {
      // test all possible status combinations - xproduct of:
      // remote: created/updated/deleted
      // local: synced/created/updated/deleted/doesnt exist
      mock_projects: {
        created: [{ id: 'remote_pCreated1' }],
        updated: [{ id: 'pSynced1', name: 'new1' }],
        deleted: [],
      },
      mock_tasks: {
        created: [],
        updated: [{ id: 'remote_tUpdated1' }],
        deleted: ['tDeleted1', 'tSynced1'],
      },
      mock_comments: {
        created: [],
        updated: [],
        deleted: ['remote_cDeleted1'],
      },
    }
    await applyRemoteChanges(database, remoteChanges)
  })
  it.skip('only emits one collection batch change', async () => {
    // TODO
  })
})
