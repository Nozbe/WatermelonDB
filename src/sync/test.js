import { change } from 'rambdax'
import clone from 'lodash.clonedeep'
import { mockDatabase } from '../__tests__/testModels'

import { fetchLocalChanges, markLocalChangesAsSynced, applyRemoteChanges } from './impl'
import { addToRawSet, setRawColumnChange } from './helpers'
import { resolveConflict, prepareCreateFromRaw } from './syncHelpers'

describe('addToRawSet', () => {
  it('transforms raw set', () => {
    expect(addToRawSet('', 'foo')).toBe('foo')
    expect(addToRawSet('foo', 'bar')).toBe('foo,bar')
    expect(addToRawSet('foo,bar', 'baz')).toBe('foo,bar,baz')
    expect(addToRawSet('foo,bar', 'foo')).toBe('foo,bar')
    expect(addToRawSet('foo,bar', 'bar')).toBe('foo,bar')
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
  it('ignores missing remote columns', () => {
    expect(
      resolveConflict(
        { col1: 'a', col2: true, col3: 20, _status: 'updated', _changed: 'col2' },
        { col2: false },
      ),
    ).toEqual({ _status: 'updated', _changed: 'col2', col1: 'a', col2: true, col3: 20 })
  })
})

const getRaw = (collection, id) => collection.find(id).then(record => record._raw, () => null)

const expectSyncedAndMatches = async (collection, id, match) =>
  expect(await getRaw(collection, id)).toMatchObject({
    _status: 'synced',
    _changed: '',
    id,
    ...match,
  })

const emptyChangeSet = Object.freeze({
  mock_projects: { created: [], updated: [], deleted: [] },
  mock_tasks: { created: [], updated: [], deleted: [] },
  mock_comments: { created: [], updated: [], deleted: [] },
})
const emptyLocalChanges = Object.freeze({ changes: emptyChangeSet, affectedRecords: [] })

const makeChangeSet = set => change(emptyChangeSet, '', set)
const testApplyRemoteChanges = (db, set) => applyRemoteChanges(db, makeChangeSet(set))

const makeLocalChanges = async mock => {
  const { database, projects, tasks, comments } = mock

  // create records
  const created = obj => ({ _status: 'created', ...obj })
  const timestamps = { created_at: 1000, updated_at: 2000 }

  const records = {
    pSynced: prepareCreateFromRaw(projects, { id: 'pSynced' }),
    pCreated1: prepareCreateFromRaw(projects, created({ id: 'pCreated1' })),
    pCreated2: prepareCreateFromRaw(projects, created({ id: 'pCreated2' })),
    pUpdated: prepareCreateFromRaw(projects, { id: 'pUpdated' }),
    pDeleted: prepareCreateFromRaw(projects, { id: 'pDeleted' }),
    tSynced: prepareCreateFromRaw(tasks, { id: 'tSynced' }),
    tCreated: prepareCreateFromRaw(tasks, created({ id: 'tCreated' })),
    tUpdated: prepareCreateFromRaw(tasks, {
      id: 'tUpdated',
      name: 'orig',
      description: 'orig',
      project_id: 'orig',
    }),
    tDeleted: prepareCreateFromRaw(tasks, { id: 'tDeleted' }),
    cSynced: prepareCreateFromRaw(comments, { id: 'cSynced', ...timestamps }),
    cCreated: prepareCreateFromRaw(comments, created({ id: 'cCreated', ...timestamps })),
    cUpdated: prepareCreateFromRaw(comments, { id: 'cUpdated', ...timestamps }),
    cDeleted: prepareCreateFromRaw(comments, { id: 'cDeleted', ...timestamps }),
    cDestroyed: prepareCreateFromRaw(comments, { id: 'cDestroyed' }),
  }

  await database.batch(...Object.values(records))

  // update records
  await records.pUpdated.update(p => {
    p.name = 'local'
  })
  await records.tUpdated.update(p => {
    p.name = 'local'
    p.position = 100
  })
  await records.cUpdated.update(c => {
    c.body = 'local'
  })
  await records.tDeleted.update(t => {
    t.name = 'local'
  })

  // delete records
  await records.pDeleted.markAsDeleted()
  await records.tDeleted.markAsDeleted()
  await records.cDeleted.markAsDeleted()
  await records.cDestroyed.destroyPermanently() // sanity check

  return records
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
      pCreated1,
      pCreated2,
      pUpdated,
      tCreated,
      tUpdated,
      tDeleted,
      cCreated,
      cUpdated,
    } = await makeLocalChanges(mock)

    // check
    expect(pCreated1._raw._status).toBe('created')
    expect(pUpdated._raw._status).toBe('updated')
    expect(pUpdated._raw._changed).toBe('name')
    expect(tDeleted._raw._status).toBe('deleted')
    const expectedChanges = clone({
      mock_projects: {
        created: [pCreated1._raw, pCreated2._raw],
        updated: [pUpdated._raw],
        deleted: ['pDeleted'],
      },
      mock_tasks: { created: [tCreated._raw], updated: [tUpdated._raw], deleted: ['tDeleted'] },
      mock_comments: {
        created: [cCreated._raw],
        updated: [cUpdated._raw],
        deleted: ['cDeleted'],
      },
    })
    const expectedAffectedRecords = [
      pCreated1,
      pCreated2,
      pUpdated,
      tCreated,
      tUpdated,
      cCreated,
      cUpdated,
    ]
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

    const { pUpdated } = await makeLocalChanges(mock)

    const { changes } = await fetchLocalChanges(database)
    const changesCloned = clone(changes)

    // raws should be cloned - further changes don't affect result
    await pUpdated.update(p => {
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
    const { database, adapter, projects, tasks } = mock

    await makeLocalChanges(mock)

    const projectCount = await projects.query().fetchCount()
    const taskCount = await tasks.query().fetchCount()

    await markLocalChangesAsSynced(database, await fetchLocalChanges(database))

    // no more changes
    expect(await fetchLocalChanges(database)).toEqual(emptyLocalChanges)

    // still just as many objects
    const projectList = await projects.query().fetch()
    const taskList = await tasks.query().fetch()
    expect(projectList.length).toBe(projectCount)
    expect(taskList.length).toBe(taskCount)

    // all objects marked as synced
    expect(projectList.every(record => record.syncStatus === 'synced')).toBe(true)
    expect(taskList.every(record => record.syncStatus === 'synced')).toBe(true)

    // no objects marked as deleted
    expect(await adapter.getDeletedRecords('mock_projects')).toEqual([])
    expect(await adapter.getDeletedRecords('mock_tasks')).toEqual([])
    expect(await adapter.getDeletedRecords('mock_comments')).toEqual([])
  })
  it(`doesn't modify updated_at timestamps`, async () => {
    const mock = mockDatabase()
    const { database, comments } = mock

    await makeLocalChanges(mock)
    const updatedAt = (await getRaw(comments, 'cUpdated')).updated_at
    await markLocalChangesAsSynced(database, await fetchLocalChanges(database))

    await expectSyncedAndMatches(comments, 'cCreated', { created_at: 1000, updated_at: 2000 })
    await expectSyncedAndMatches(comments, 'cUpdated', { created_at: 1000, updated_at: updatedAt })
    await expectSyncedAndMatches(comments, 'cSynced', { created_at: 1000, updated_at: 2000 })
  })
  it(`doesn't mark as synced records that changed since changes were fetched`, async () => {
    const mock = mockDatabase()
    const { database, projects, tasks } = mock

    const {
      pSynced,
      tSynced,
      tCreated,
      tUpdated,
      cSynced,
      cCreated,
      cUpdated,
      cDeleted,
    } = await makeLocalChanges(mock)
    const localChanges = await fetchLocalChanges(database)

    // simulate user making changes the the app while sync push request is in progress

    // non-confliting changes: new record, update synced record, delete synced record
    const newProject = await projects.create()
    await pSynced.update(() => {
      pSynced.name = 'local2'
    })
    await tSynced.markAsDeleted()
    await cSynced.destroyPermanently()

    // conflicting changes: update updated/created, delete created/updated/deleted
    await tCreated.update(() => {
      tCreated.name = 'local2'
    })
    await tUpdated.update(() => {
      tUpdated.name = 'local2' // change what was already changed
      tUpdated.description = 'local2' // new change
    })
    await cCreated.markAsDeleted()
    await cUpdated.markAsDeleted()
    await cDeleted.destroyPermanently()

    // mark local changes as synced; check if new changes are still pending sync
    await markLocalChangesAsSynced(database, localChanges)

    const localChanges2 = await fetchLocalChanges(database)
    expect(localChanges2.changes).toEqual({
      mock_projects: { created: [newProject._raw], updated: [pSynced._raw], deleted: [] },
      mock_tasks: { created: [tCreated._raw], updated: [tUpdated._raw], deleted: ['tSynced'] },
      mock_comments: { created: [], updated: [], deleted: ['cUpdated', 'cCreated'] },
    })
    expect(localChanges2.affectedRecords).toEqual([pSynced, newProject, tCreated, tUpdated])

    await expectSyncedAndMatches(tasks, 'tUpdated', {
      _status: 'updated',
      // TODO: ideally position would probably not be here
      _changed: 'name,position,description',
      name: 'local2',
      description: 'local2',
      position: 100,
    })

    // test that second push will mark all as synced
    await markLocalChangesAsSynced(database, localChanges2)
    expect(await fetchLocalChanges(database)).toEqual(emptyLocalChanges)
  })
  // TODO: Unskip the test when batch collection emissions are implemented
  it.skip('only emits one collection batch change', async () => {
    const mock = mockDatabase()
    const { database, projects } = mock

    const { pCreated1 } = await makeLocalChanges(mock)
    const localChanges = await fetchLocalChanges(database)

    const projectsObserver = jest.fn()
    projects.changes.subscribe(projectsObserver)

    await markLocalChangesAsSynced(database, localChanges)

    expect(projectsObserver).toBeCalledTimes(1)
    expect(projectsObserver).toBeCalledWith([
      { type: 'created', record: pCreated1 },
      // TODO: missing changes + changes in other collections
    ])
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
  // Note: We need to test all possible status combinations - xproduct of:
  // remote: created/updated/deleted
  // local: synced/created/updated/deleted/doesn't exist
  // (15 cases)
  it('can create, update, delete records', async () => {
    const mock = mockDatabase()
    const { database, projects, tasks, comments } = mock

    await makeLocalChanges(mock)
    await testApplyRemoteChanges(database, {
      mock_projects: {
        // create / doesn't exist - create
        created: [{ id: 'new_project', name: 'remote' }],
      },
      mock_tasks: {
        // update / synced - update (stay synced)
        updated: [{ id: 'tSynced', name: 'remote' }],
      },
      mock_comments: {
        // delete / synced - destroy
        deleted: ['cSynced'],
      },
    })

    await expectSyncedAndMatches(projects, 'new_project', { name: 'remote' })
    await expectSyncedAndMatches(tasks, 'tSynced', { name: 'remote' })
    expect(await getRaw(comments, 'cSynced')).toBe(null)
  })
  it('can resolve update conflicts', async () => {
    const mock = mockDatabase()
    const { database, tasks, comments } = mock

    await makeLocalChanges(mock)
    await testApplyRemoteChanges(database, {
      mock_tasks: {
        updated: [
          // update / updated - resolve and update (stay updated)
          { id: 'tUpdated', name: 'remote', description: 'remote' },
        ],
      },
      mock_comments: {
        updated: [{ id: 'cDeleted', body: 'remote' }],
      },
    })

    await expectSyncedAndMatches(tasks, 'tUpdated', {
      _status: 'updated',
      _changed: 'name,position',
      name: 'local', // local change preserved
      position: 100,
      description: 'remote', // remote change
      project_id: 'orig', // unchanged
    })
    await expectSyncedAndMatches(comments, 'cDeleted', { _status: 'deleted', body: '' })
  })
  it('can delete records in all edge cases', async () => {
    const mock = mockDatabase()
    const { database, projects } = mock

    await makeLocalChanges(mock)
    await testApplyRemoteChanges(database, {
      mock_projects: {
        deleted: [
          'does_not_exist', // delete / doesn't exist - ignore
          'pCreated', // delete / created - weird. destroy
          'pUpdated', // delete / updated - destroy
          'pDeleted', // delete / deleted - destroy
        ],
      },
    })

    expect(await getRaw(projects, 'does_not_exist')).toBe(null)
    expect(await getRaw(projects, 'pCreated')).toBe(null)
    expect(await getRaw(projects, 'pUpdated')).toBe(null)
    expect(await getRaw(projects, 'pDeleted')).toBe(null)
  })
  it('can handle sync failure cases', async () => {
    const mock = mockDatabase()
    const { database, tasks } = mock

    await makeLocalChanges(mock)
    await testApplyRemoteChanges(database, {
      mock_tasks: {
        // these cases can occur when sync fails for some reason and the same records are fetched and reapplied:
        created: [
          // create / synced - resolve and update (stay synced)
          { id: 'tSynced', name: 'remote' },
          // create / updated - resolve and update (stay updated)
          { id: 'tUpdated', name: 'remote', description: 'remote' },
          // create / deleted - destroy and recreate? (or just un-delete?)
          { id: 'tDeleted', name: 'remote' },
        ],
      },
    })

    await expectSyncedAndMatches(tasks, 'tSynced', { name: 'remote' })
    await expectSyncedAndMatches(tasks, 'tUpdated', {
      _status: 'updated',
      _changed: 'name,position',
      name: 'local', // local change preserved
      position: 100,
      description: 'remote', // remote change
      project_id: 'orig', // unchanged
    })
    await expectSyncedAndMatches(tasks, 'tDeleted', { name: 'remote' })
  })
  it('can handle weird edge cases', async () => {
    const mock = mockDatabase()
    const { database, projects, tasks } = mock

    await makeLocalChanges(mock)
    await testApplyRemoteChanges(database, {
      mock_projects: {
        created: [
          // create / created - very weird case. update with resolution (stay synced)
          { id: 'pCreated', name: 'remote' },
        ],
      },
      mock_tasks: {
        updated: [
          // update / created - very weird. resolve and update (stay synced)
          { id: 'tCreated', name: 'remote' },
          // update / doesn't exist - create (stay synced)
          { id: 'does_not_exist', name: 'remote' },
        ],
      },
    })

    await expectSyncedAndMatches(projects, 'pCreated', { name: 'remote' })
    await expectSyncedAndMatches(tasks, 'tCreated', { name: 'remote' })
    await expectSyncedAndMatches(tasks, 'does_not_exist', { name: 'remote' })
  })
  it(`doesn't touch created_at/updated_at when applying updates`, async () => {
    const mock = mockDatabase()
    const { database, comments } = mock

    await makeLocalChanges(mock)
    await testApplyRemoteChanges(database, {
      mock_comments: {
        updated: [{ id: 'cSynced', body: 'remote' }],
      },
    })

    await expectSyncedAndMatches(comments, 'cSynced', {
      created_at: 1000,
      updated_at: 2000,
      body: 'remote',
    })
  })
  it('can replace created_at/updated_at during sync', async () => {
    const mock = mockDatabase()
    const { database, comments } = mock

    await makeLocalChanges(mock)
    await testApplyRemoteChanges(database, {
      mock_comments: {
        created: [{ id: 'cNew', created_at: 1, updated_at: 2 }],
        updated: [{ id: 'cSynced', created_at: 10, updated_at: 20 }],
      },
    })

    await expectSyncedAndMatches(comments, 'cNew', { created_at: 1, updated_at: 2, body: '' })
    await expectSyncedAndMatches(comments, 'cSynced', { created_at: 10, updated_at: 20, body: '' })
  })
  it.skip(`doesn't destroy dependent objects`, async () => {
    // TODO: Add this test when fast delete is implemented
  })
  it.skip('only emits one collection batch change', async () => {
    // TODO: Implement and unskip test when batch change emissions are implemented
  })
})
