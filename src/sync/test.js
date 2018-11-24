import { change } from 'rambdax'
import { skip as skip$ } from 'rxjs/operators'
import clone from 'lodash.clonedeep'
import { mockDatabase } from '../__tests__/testModels'

import { synchronize } from './index'
import {
  fetchLocalChanges,
  markLocalChangesAsSynced,
  applyRemoteChanges,
  getLastSyncedAt,
} from './impl'
import { resolveConflict, prepareCreateFromRaw } from './syncHelpers'

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
const expectDoesNotExist = async (collection, id) => expect(await getRaw(collection, id)).toBe(null)

const emptyChangeSet = Object.freeze({
  mock_projects: { created: [], updated: [], deleted: [] },
  mock_tasks: { created: [], updated: [], deleted: [] },
  mock_comments: { created: [], updated: [], deleted: [] },
})
const emptyLocalChanges = Object.freeze({ changes: emptyChangeSet, affectedRecords: [] })

const makeChangeSet = set => change(emptyChangeSet, '', set)
const testApplyRemoteChanges = (db, set) => applyRemoteChanges(db, makeChangeSet(set))

const makeLocalChanges = async database => {
  const projects = database.collections.get('mock_projects')
  const tasks = database.collections.get('mock_tasks')
  const comments = database.collections.get('mock_comments')

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
    // eslint-disable-next-line
    let { database, cloneDatabase } = mockDatabase()

    const {
      pCreated1,
      pCreated2,
      pUpdated,
      tCreated,
      tUpdated,
      tDeleted,
      cCreated,
      cUpdated,
    } = await makeLocalChanges(database)

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
    const { database } = mockDatabase()

    const { pUpdated } = await makeLocalChanges(database)

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
    const { database } = mockDatabase()

    await makeLocalChanges(database)
    const localChanges1 = await fetchLocalChanges(database)

    await markLocalChangesAsSynced(database, { changes: emptyChangeSet, affectedRecords: [] })

    const localChanges2 = await fetchLocalChanges(database)
    expect(localChanges1).toEqual(localChanges2)
  })
  it('marks local changes as synced', async () => {
    const { database, adapter, projects, tasks } = mockDatabase()

    await makeLocalChanges(database)

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
    const { database, comments } = mockDatabase()

    await makeLocalChanges(database)
    const updatedAt = (await getRaw(comments, 'cUpdated')).updated_at
    await markLocalChangesAsSynced(database, await fetchLocalChanges(database))

    await expectSyncedAndMatches(comments, 'cCreated', { created_at: 1000, updated_at: 2000 })
    await expectSyncedAndMatches(comments, 'cUpdated', { created_at: 1000, updated_at: updatedAt })
    await expectSyncedAndMatches(comments, 'cSynced', { created_at: 1000, updated_at: 2000 })
  })
  it(`doesn't mark as synced records that changed since changes were fetched`, async () => {
    const { database, projects, tasks } = mockDatabase()

    const {
      pSynced,
      tSynced,
      tCreated,
      tUpdated,
      cSynced,
      cCreated,
      cUpdated,
      cDeleted,
    } = await makeLocalChanges(database)
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
    const { database, projects } = mockDatabase()

    const { pCreated1 } = await makeLocalChanges(database)
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
    const { database } = mockDatabase()

    await makeLocalChanges(database)
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
    const { database, projects, tasks, comments } = mockDatabase()

    await makeLocalChanges(database)
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
    await expectDoesNotExist(comments, 'cSynced')
  })
  it('can resolve update conflicts', async () => {
    const { database, tasks, comments } = mockDatabase()

    await makeLocalChanges(database)
    await testApplyRemoteChanges(database, {
      mock_tasks: {
        updated: [
          // update / updated - resolve and update (stay updated)
          { id: 'tUpdated', name: 'remote', description: 'remote' },
        ],
      },
      mock_comments: {
        // update / deleted - ignore (will be synced anyway)
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
    const { database, projects } = mockDatabase()

    await makeLocalChanges(database)
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

    await expectDoesNotExist(projects, 'does_not_exist')
    await expectDoesNotExist(projects, 'pCreated')
    await expectDoesNotExist(projects, 'pUpdated')
    await expectDoesNotExist(projects, 'pDeleted')
  })
  it('can handle sync failure cases', async () => {
    const { database, tasks } = mockDatabase()

    await makeLocalChanges(database)
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
    const { database, projects, tasks } = mockDatabase()

    await makeLocalChanges(database)
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
    const { database, comments } = mockDatabase()

    await makeLocalChanges(database)
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
    const { database, comments } = mockDatabase()

    await makeLocalChanges(database)
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

const observeDatabase = database => {
  const observer = jest.fn()
  const tables = ['mock_projects', 'mock_tasks', 'mock_comments']
  expect(tables).toEqual(Object.keys(database.collections.map))
  database
    .withChangesForTables(tables)
    .pipe(skip$(1))
    .subscribe(observer)
  return observer
}

const emptyPull = (timestamp = 1500) => async () => ({ changes: emptyChangeSet, timestamp })

describe('synchronize', () => {
  it('can perform an empty sync', async () => {
    const { database } = mockDatabase()
    const observer = observeDatabase(database)

    const pullChanges = jest.fn(emptyPull())
    const pushChanges = jest.fn()

    await synchronize({ database, pullChanges, pushChanges })

    expect(observer).toBeCalledTimes(0)
    expect(pullChanges).toBeCalledTimes(1)
    expect(pullChanges).toBeCalledWith({ lastSyncedAt: null })
    expect(pushChanges).toBeCalledTimes(1)
    expect(pushChanges).toBeCalledWith({ changes: emptyChangeSet })
  })
  it.skip(`doesn't push changes if nothing to push`, async () => {
    // TODO: Future optimization
  })
  it('can push changes', async () => {
    const { database } = mockDatabase()

    await makeLocalChanges(database)
    const localChanges = await fetchLocalChanges(database)

    const pullChanges = jest.fn(emptyPull())
    const pushChanges = jest.fn()
    await synchronize({ database, pullChanges, pushChanges })

    expect(pushChanges).toBeCalledWith({ changes: localChanges.changes })
    expect(await fetchLocalChanges(database)).toEqual(emptyLocalChanges)
  })
  it('can pull changes', async () => {
    const { database, projects, tasks } = mockDatabase()

    const pullChanges = jest.fn(async () => ({
      changes: makeChangeSet({
        mock_projects: {
          created: [{ id: 'new_project', name: 'remote' }],
          updated: [{ id: 'pSynced', name: 'remote' }],
        },
        mock_tasks: {
          deleted: ['tSynced'],
        },
      }),
      timestamp: 1500,
    }))
    const pushChanges = jest.fn(async () => {})

    await synchronize({ database, pullChanges, pushChanges })

    expect(pullChanges).toBeCalledWith({ lastSyncedAt: null })
    expect(pushChanges).toBeCalledWith({ changes: emptyChangeSet })

    expect(await fetchLocalChanges(database)).toEqual(emptyLocalChanges)
    await expectSyncedAndMatches(projects, 'new_project', { name: 'remote' })
    await expectSyncedAndMatches(projects, 'pSynced', { name: 'remote' })
    await expectDoesNotExist(tasks, 'tSynced')
  })
  it('can synchronize changes with conflicts', async () => {
    const { database, projects, tasks, comments } = mockDatabase()

    await makeLocalChanges(database)
    const localChanges = await fetchLocalChanges(database)

    const pullChanges = async () => ({
      changes: makeChangeSet({
        mock_projects: {
          created: [{ id: 'pCreated1', name: 'remote' }], // error - update, stay synced
          deleted: ['pUpdated', 'does_not_exist', 'pDeleted'],
        },
        mock_tasks: {
          updated: [
            { id: 'tUpdated', name: 'remote', description: 'remote' }, // just a conflict; stay updated
            { id: 'tDeleted', body: 'remote' }, // ignore
          ],
        },
        mock_comments: {
          created: [
            { id: 'cUpdated', body: 'remote', task_id: 'remote' }, // error - resolve and update (stay updated)
          ],
        },
      }),
      timestamp: 1500,
    })
    const pushChanges = jest.fn(async () => {})

    await synchronize({ database, pullChanges, pushChanges })

    expect(pushChanges).toBeCalledTimes(1)
    const pushedChanges = pushChanges.mock.calls[0][0].changes
    expect(pushedChanges).not.toEqual(localChanges.changes)
    expect(pushedChanges.mock_projects.created).not.toContainEqual(
      await getRaw(projects, 'pCreated1'),
    )
    expect(pushedChanges.mock_projects.deleted).not.toContain('pDeleted')
    expect(pushedChanges.mock_tasks.updated).toContainEqual({
      // TODO: That's just dirty
      ...(await getRaw(tasks, 'tUpdated')),
      _status: 'updated',
      _changed: 'name,position',
    })
    expect(pushedChanges.mock_tasks.deleted).toContain('tDeleted')
    expect(pushedChanges.mock_comments.updated).toContainEqual({
      // TODO: That's just dirty
      ...(await getRaw(comments, 'cUpdated')),
      _status: 'updated',
      _changed: 'updated_at,body',
    })

    await expectSyncedAndMatches(projects, 'pCreated1', { name: 'remote' })
    await expectDoesNotExist(projects, 'pUpdated')
    await expectDoesNotExist(projects, 'pDeleted')
    await expectSyncedAndMatches(tasks, 'tUpdated', { name: 'local', description: 'remote' })
    await expectDoesNotExist(tasks, 'tDeleted')
    await expectSyncedAndMatches(comments, 'cUpdated', { body: 'local', task_id: 'remote' })

    expect(await fetchLocalChanges(database)).toEqual(emptyLocalChanges)
  })
  it('remembers last_synced_at timestamp', async () => {
    const { database } = mockDatabase()

    let pullChanges = jest.fn(emptyPull(1500))
    await synchronize({ database, pullChanges, pushChanges: jest.fn() })

    expect(pullChanges).toBeCalledWith({ lastSyncedAt: null })

    pullChanges = jest.fn(emptyPull(2500))
    await synchronize({ database, pullChanges, pushChanges: jest.fn() })

    expect(pullChanges).toBeCalledTimes(1)
    expect(pullChanges).toBeCalledWith({ lastSyncedAt: 1500 })
    expect(await getLastSyncedAt(database)).toBe(2500)
    // check underlying database since it's an implicit API
    expect(await database.adapter.getLocal('__watermelon_last_synced_at')).toBe('2500')
  })
  it('prevents concurrent syncs', async () => {
    const { database } = mockDatabase()

    const delayPromise = delay => new Promise(resolve => setTimeout(resolve, delay))
    const syncWithDelay = delay =>
      synchronize({
        database,
        pullChanges: () => delayPromise(delay).then(emptyPull(delay)),
        pushChanges: jest.fn(),
      })

    const sync1 = syncWithDelay(100)
    const sync2 = syncWithDelay(300).catch(error => error)

    expect(await sync1).toBe(undefined)
    expect(await sync2).toMatchObject({ message: /concurrent sync/i })
    expect(await getLastSyncedAt(database)).toBe(100)
  })
  it('can recover from pull failure', async () => {
    const { database } = mockDatabase()

    const observer = observeDatabase(database)
    const pullChanges = jest.fn(() => Promise.reject(new Error('pull-fail')))
    const pushChanges = jest.fn()
    const sync = await synchronize({ database, pullChanges, pushChanges }).catch(e => e)

    expect(observer).toBeCalledTimes(0)
    expect(pullChanges).toBeCalledTimes(1)
    expect(pushChanges).toBeCalledTimes(0)
    expect(sync).toMatchObject({ message: 'pull-fail' })
    expect(await getLastSyncedAt(database)).toBe(null)
  })
  it('can recover from push failure', async () => {
    const { database, projects } = mockDatabase()

    await makeLocalChanges(database)
    const localChanges = await fetchLocalChanges(database)

    const observer = observeDatabase(database)
    const pullChanges = async () => ({
      changes: makeChangeSet({
        mock_projects: {
          created: [{ id: 'new_project', name: 'remote' }],
        },
      }),
      timestamp: 1500,
    })
    const pushChanges = jest.fn(() => Promise.reject(new Error('push-fail')))
    const sync = await synchronize({ database, pullChanges, pushChanges }).catch(e => e)

    // full sync failed - local changes still awaiting sync
    expect(pushChanges).toBeCalledWith({ changes: localChanges.changes })
    expect(sync).toMatchObject({ message: 'push-fail' })
    expect(await fetchLocalChanges(database)).toEqual(localChanges)

    // but pull phase succeeded
    expect(await getLastSyncedAt(database)).toBe(1500)
    expect(observer).toBeCalledTimes(1)
    await expectSyncedAndMatches(projects, 'new_project', { name: 'remote' })
  })
  it.skip('can handle local changes during sync', async () => {
    // TODO:
  })
  it.skip('can synchronize lots of data', async () => {
    // TODO:
  })
})
