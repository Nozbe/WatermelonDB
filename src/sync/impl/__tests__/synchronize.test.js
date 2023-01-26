import clone from 'lodash.clonedeep'
import { delay, omit } from 'rambdax'
import { skip as skip$ } from 'rxjs/operators'
import { expectToRejectWithMessage } from '../../../__tests__/utils'
import {
  makeDatabase,
  emptyLocalChanges,
  expectSyncedAndMatches,
  getRaw,
  makeLocalChanges,
  makeChangeSet,
  expectDoesNotExist,
  prepareCreateFromRaw,
  emptyPull,
} from './helpers'

import { synchronize, hasUnsyncedChanges } from '../../index'
import { fetchLocalChanges, getLastPulledAt } from '../index'

const observeDatabase = (database) => {
  const observer = jest.fn()
  const tables = ['mock_projects', 'mock_project_sections', 'mock_tasks', 'mock_comments']
  expect(tables).toEqual(Object.keys(database.collections.map))
  database.withChangesForTables(tables).pipe(skip$(1)).subscribe(observer)
  return observer
}

describe('synchronize', () => {
  it('can perform an empty sync', async () => {
    const { database } = makeDatabase()
    const observer = observeDatabase(database)

    const pullChanges = jest.fn(emptyPull())

    await synchronize({ database, pullChanges, pushChanges: jest.fn() })

    expect(observer).toHaveBeenCalledTimes(0)
    expect(pullChanges).toHaveBeenCalledTimes(1)
    expect(pullChanges).toHaveBeenCalledWith({
      lastPulledAt: null,
      schemaVersion: 1,
      migration: null,
    })
  })
  it(`doesn't push changes if nothing to push`, async () => {
    const { database } = makeDatabase()

    const pushChanges = jest.fn()
    await synchronize({ database, pullChanges: jest.fn(emptyPull()), pushChanges })

    expect(pushChanges).toHaveBeenCalledTimes(0)
  })
  it('can log basic information about a sync', async () => {
    const { database } = makeDatabase()

    const log = {}
    await synchronize({
      database,
      pullChanges: async () => {
        // ensure we take more than 1ms for the log test
        await new Promise((resolve) => {
          setTimeout(resolve, 10)
        })
        return emptyPull()()
      },
      pushChanges: () => {},
      log,
    })

    expect(log.startedAt).toBeInstanceOf(Date)
    expect(log.finishedAt).toBeInstanceOf(Date)
    expect(log.finishedAt.getTime()).toBeGreaterThan(log.startedAt.getTime())
    expect(log.phase).toBe('done')

    expect(log.lastPulledAt).toBe(null)
    expect(log.newLastPulledAt).toBe(1500)

    expect(log.error).toBe(undefined)

    expect(log.remoteChangeCount).toBe(0)
    expect(log.localChangeCount).toBe(0)
  })
  it(`notifies user about remote change count`, async () => {
    const { database } = makeDatabase()

    const onWillApplyRemoteChanges = jest.fn()
    await synchronize({
      database,
      pullChanges: emptyPull(),
      pushChanges: () => {},
      onWillApplyRemoteChanges,
    })
    expect(onWillApplyRemoteChanges).toHaveBeenCalledTimes(1)
    expect(onWillApplyRemoteChanges).toHaveBeenCalledWith({ remoteChangeCount: 0 })

    // real changes
    const onWillApplyRemoteChanges2 = jest.fn(async () => {
      await delay(100)
    })
    await synchronize({
      database,
      pullChanges: () => ({
        changes: makeChangeSet({
          mock_projects: {
            created: [{ id: 'new_project', name: 'remote' }],
          },
          mock_tasks: {
            updated: [{ id: 'task_1', name: 'remote' }],
            deleted: ['task_2'],
          },
        }),
        timestamp: 1500,
      }),
      pushChanges: () => {},
      onWillApplyRemoteChanges: onWillApplyRemoteChanges2,
    })
    expect(onWillApplyRemoteChanges2).toHaveBeenCalledTimes(1)
    expect(onWillApplyRemoteChanges2).toHaveBeenCalledWith({ remoteChangeCount: 3 })
  })
  it('will not push changes if no `pushChanges`', async () => {
    const { database } = makeDatabase()

    await makeLocalChanges(database)

    const pullChanges = async () => {
      // ensure we take more than 1ms for the log test
      await new Promise((resolve) => {
        setTimeout(resolve, 10)
      })
      return emptyPull()()
    }
    const log = {}
    await synchronize({ database, pullChanges, log })
    expect(log.startedAt).toBeInstanceOf(Date)
    expect(log.finishedAt).toBeInstanceOf(Date)
    expect(log.finishedAt.getTime()).toBeGreaterThan(log.startedAt.getTime())
    expect(log.phase).toBe('done')
  })
  it('can push changes', async () => {
    const { database } = makeDatabase()

    await makeLocalChanges(database)
    const localChanges = await fetchLocalChanges(database)

    const pullChanges = jest.fn(emptyPull())
    const pushChanges = jest.fn()
    const log = {}
    await synchronize({ database, pullChanges, pushChanges, log })

    expect(pushChanges).toHaveBeenCalledWith({ changes: localChanges.changes, lastPulledAt: 1500 })
    expect(await fetchLocalChanges(database)).toEqual(emptyLocalChanges)
    expect(log.localChangeCount).toBe(10)
  })
  it('can pull changes', async () => {
    const { database, projects, tasks } = makeDatabase()

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

    await synchronize({ database, pullChanges, pushChanges: jest.fn() })

    expect(pullChanges).toHaveBeenCalledWith({
      lastPulledAt: null,
      schemaVersion: 1,
      migration: null,
    })

    expect(await fetchLocalChanges(database)).toEqual(emptyLocalChanges)
    await expectSyncedAndMatches(projects, 'new_project', { name: 'remote' })
    await expectSyncedAndMatches(projects, 'pSynced', { name: 'remote' })
    await expectDoesNotExist(tasks, 'tSynced')
  })
  it('can synchronize changes with conflicts', async () => {
    const { database, projects, tasks, comments } = makeDatabase()

    const records = await makeLocalChanges(database)
    const tUpdatedInitial = { ...records.tUpdated._raw }
    const cUpdatedInitial = { ...records.cUpdated._raw }

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
    const pushChanges = jest.fn()

    const log = {}
    await synchronize({ database, pullChanges, pushChanges, log })

    expect(pushChanges).toHaveBeenCalledTimes(1)
    const pushedChanges = pushChanges.mock.calls[0][0].changes
    expect(pushedChanges).not.toEqual(localChanges.changes)
    expect(pushedChanges.mock_projects.created).not.toContainEqual(
      await getRaw(projects, 'pCreated1'),
    )
    expect(pushedChanges.mock_projects.deleted).not.toContain('pDeleted')
    const tUpdatedResolvedExpected = {
      // TODO: That's just dirty
      ...(await getRaw(tasks, 'tUpdated')),
      _status: 'updated',
      _changed: 'name,position',
    }
    expect(pushedChanges.mock_tasks.updated).toContainEqual(tUpdatedResolvedExpected)
    expect(pushedChanges.mock_tasks.deleted).toContain('tDeleted')
    const cUpdatedResolvedExpected = {
      // TODO: That's just dirty
      ...(await getRaw(comments, 'cUpdated')),
      _status: 'updated',
      _changed: 'updated_at,body',
    }
    expect(pushedChanges.mock_comments.updated).toContainEqual(cUpdatedResolvedExpected)

    await expectSyncedAndMatches(projects, 'pCreated1', { name: 'remote' })
    await expectDoesNotExist(projects, 'pUpdated')
    await expectDoesNotExist(projects, 'pDeleted')
    await expectSyncedAndMatches(tasks, 'tUpdated', { name: 'local', description: 'remote' })
    await expectDoesNotExist(tasks, 'tDeleted')
    await expectSyncedAndMatches(comments, 'cUpdated', { body: 'local', task_id: 'remote' })

    expect(await fetchLocalChanges(database)).toEqual(emptyLocalChanges)

    // check that log is good
    expect(log.remoteChangeCount).toBe(7)
    expect(log.resolvedConflicts).toEqual([
      {
        local: tUpdatedInitial,
        remote: { id: 'tUpdated', name: 'remote', description: 'remote' },
        resolved: tUpdatedResolvedExpected,
      },
      {
        local: cUpdatedInitial,
        remote: { id: 'cUpdated', body: 'remote', task_id: 'remote' },
        resolved: cUpdatedResolvedExpected,
      },
    ])
  })
  it(`allows conflict resolution to be customized`, async () => {
    const { database, projects, tasks } = makeDatabase()

    await database.write(async () => {
      await database.batch(
        prepareCreateFromRaw(projects, { id: 'p1', _status: 'synced', name: 'local' }),
        prepareCreateFromRaw(projects, { id: 'p2', _status: 'created', name: 'local' }),
        prepareCreateFromRaw(tasks, { id: 't1', _status: 'synced' }),
        prepareCreateFromRaw(tasks, { id: 't2', _status: 'created' }),
        prepareCreateFromRaw(tasks, {
          id: 't3',
          _status: 'updated',
          name: 'local',
          _changd: 'name',
        }),
      )
    })

    const conflictResolver = jest.fn((table, local, remote, resolved) => {
      if (table === 'mock_tasks') {
        resolved.name = 'GOTCHA'
      }
      return resolved
    })

    const pullChanges = async () => ({
      changes: makeChangeSet({
        mock_projects: {
          created: [{ id: 'p2', name: 'remote' }], // error - update, stay synced
          updated: [{ id: 'p1', name: 'change' }], // update
        },
        mock_tasks: {
          updated: [
            { id: 't1', name: 'remote' }, // update
            { id: 't3', name: 'remote' }, // conflict
          ],
        },
      }),
      timestamp: 1500,
    })
    await synchronize({ database, pullChanges, pushChanges: jest.fn(), conflictResolver })

    expect(conflictResolver).toHaveBeenCalledTimes(4)
    expect(conflictResolver.mock.calls[0]).toMatchObject([
      'mock_projects',
      { id: 'p2', _status: 'created', name: 'local' },
      { name: 'remote' },
      { name: 'remote' },
    ])
    expect(conflictResolver.mock.calls[1]).toMatchObject([
      'mock_projects',
      { id: 'p1', _status: 'synced' },
      { name: 'change' },
      { _status: 'synced' },
    ])
    expect(conflictResolver.mock.results[1].value).toBe(conflictResolver.mock.calls[1][3])
    expect(conflictResolver.mock.calls[2]).toMatchObject([
      'mock_tasks',
      { id: 't1', _status: 'synced', name: '' },
      { name: 'remote' },
      { name: 'GOTCHA' }, // we're mutating this arg in function, that's why
    ])

    await expectSyncedAndMatches(tasks, 't1', { name: 'GOTCHA' })
    await expectSyncedAndMatches(tasks, 't3', { name: 'GOTCHA' })

    expect(await fetchLocalChanges(database)).toEqual(emptyLocalChanges)
  })
  it('remembers last_synced_at timestamp', async () => {
    const { database } = makeDatabase()

    let pullChanges = jest.fn(emptyPull(1500))
    await synchronize({ database, pullChanges, pushChanges: jest.fn() })

    expect(pullChanges).toHaveBeenCalledWith({
      lastPulledAt: null,
      schemaVersion: 1,
      migration: null,
    })

    pullChanges = jest.fn(emptyPull(2500))
    const log = {}
    await synchronize({ database, pullChanges, pushChanges: jest.fn(), log })

    expect(pullChanges).toHaveBeenCalledTimes(1)
    expect(pullChanges).toHaveBeenCalledWith({
      lastPulledAt: 1500,
      schemaVersion: 1,
      migration: null,
    })
    expect(await getLastPulledAt(database)).toBe(2500)
    expect(log.lastPulledAt).toBe(1500)
    expect(log.newLastPulledAt).toBe(2500)
    // check underlying database since it's an implicit API
    expect(await database.adapter.getLocal('__watermelon_last_pulled_at')).toBe('2500')
  })
  it(`validates timestamp returned from pullChanges`, async () => {
    const { database } = makeDatabase()
    await expectToRejectWithMessage(
      synchronize({ database, pullChanges: jest.fn(emptyPull(0)), pushChanges: jest.fn() }),
      /pullChanges\(\) returned invalid timestamp/,
    )
  })
  it('can recover from pull failure', async () => {
    const { database } = makeDatabase()
    // make change to make sure pushChagnes isn't called because of pull failure and not lack of changes
    await makeLocalChanges(database)

    const observer = observeDatabase(database)
    const error = new Error('pull-fail')
    const pullChanges = jest.fn(() => Promise.reject(error))
    const pushChanges = jest.fn()
    const log = {}
    const sync = await synchronize({ database, pullChanges, pushChanges, log }).catch((e) => e)

    expect(observer).toHaveBeenCalledTimes(0)
    expect(pullChanges).toHaveBeenCalledTimes(1)
    expect(pushChanges).toHaveBeenCalledTimes(0)
    expect(sync).toMatchObject({ message: 'pull-fail' })
    expect(await getLastPulledAt(database)).toBe(null)
    expect(log.phase).toBe('ready to pull')
    expect(log.error).toBe(error)
  })
  it('can recover from push failure', async () => {
    const { database, projects } = makeDatabase()

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
    const sync = await synchronize({ database, pullChanges, pushChanges }).catch((e) => e)

    // full sync failed - local changes still awaiting sync
    expect(pushChanges).toHaveBeenCalledWith({ changes: localChanges.changes, lastPulledAt: 1500 })
    expect(sync).toMatchObject({ message: 'push-fail' })
    expect(await fetchLocalChanges(database)).toEqual(localChanges)

    // but pull phase succeeded
    expect(await getLastPulledAt(database)).toBe(1500)
    expect(observer).toHaveBeenCalledTimes(1)
    await expectSyncedAndMatches(projects, 'new_project', { name: 'remote' })
  })
  it('can safely handle local changes during sync', async () => {
    const { database, projects } = makeDatabase()

    await makeLocalChanges(database)
    const localChanges = await fetchLocalChanges(database)

    const pullChanges = jest.fn(async () => ({
      changes: makeChangeSet({
        mock_projects: {
          created: [{ id: 'new_project', name: 'remote' }],
        },
      }),
      timestamp: 1500,
    }))

    let betweenFetchAndMarkAction
    const pushChanges = jest.fn(
      () => betweenFetchAndMarkAction(), // this will run before push completes
    )

    let syncCompleted = false
    const sync = synchronize({ database, pullChanges, pushChanges }).then(() => {
      syncCompleted = true
    })

    const createProject = (name) =>
      projects.create((project) => {
        project.name = name
      })

    // run this between fetchLocalChanges and markLocalChangesAsSynced
    // (doesn't really matter if it's before or after pushChanges is called)
    let project3
    betweenFetchAndMarkAction = jest.fn(() =>
      database.write(async () => {
        await expectSyncedAndMatches(projects, 'new_project', {})
        expect(syncCompleted).toBe(false)
        project3 = await createProject('project3')
      }, 'betweenFetchAndMarkAction'),
    )

    // run this between applyRemoteChanges and fetchLocalChanges
    let project2
    const betweenApplyAndFetchAction = jest.fn(async () => {
      await expectSyncedAndMatches(projects, 'new_project', {})
      expect(pushChanges).toHaveBeenCalledTimes(0)
      project2 = (await createProject('project2'))._raw
    })

    // run this before applyRemoteChanges
    let project1
    const beforeApplyAction = jest.fn(async () => {
      await expectDoesNotExist(projects, 'new_project')
      project1 = (await createProject('project1'))._raw
      database.write(betweenApplyAndFetchAction, 'betweenApplyAndFetchAction')
    })
    database.write(beforeApplyAction, 'beforeApplyAction')

    // we sync successfully and have received an object
    await sync

    expect(beforeApplyAction).toHaveBeenCalledTimes(1)
    expect(betweenApplyAndFetchAction).toHaveBeenCalledTimes(1)
    expect(betweenFetchAndMarkAction).toHaveBeenCalledTimes(1)

    await expectSyncedAndMatches(projects, 'new_project', {})

    // Expect project1, project2 to have been pushed
    const pushedChanges = pushChanges.mock.calls[0][0].changes
    expect(pushedChanges).not.toEqual(localChanges.changes)
    const expectedPushedChanges = clone(localChanges.changes)
    expectedPushedChanges.mock_projects.created = [
      project2,
      project1,
      ...expectedPushedChanges.mock_projects.created,
    ]
    expect(pushedChanges).toEqual(expectedPushedChanges)

    // Expect project3 to still need pushing
    const localChanges2 = await fetchLocalChanges(database)
    expect(localChanges2).not.toEqual(emptyLocalChanges)
    expect(await hasUnsyncedChanges({ database })).toBe(true)
    expect(localChanges2).toEqual({
      changes: makeChangeSet({
        mock_projects: {
          created: [project3._raw],
        },
      }),
      affectedRecords: [project3],
    })
  })
  it(`can safely update created records during push (regression test)`, async () => {
    const { database, tasks } = makeDatabase()
    const task = tasks.prepareCreateFromDirtyRaw({
      id: 't1',
      name: 'Task name',
      position: 1,
      is_completed: false,
      project_id: 'p1',
    })
    await database.write(() => database.batch(task))
    const initialRaw = { ...task._raw }
    expect(task._raw).toMatchObject({
      _status: 'created',
      _changed: '',
      position: 1,
      is_completed: false,
    })
    await synchronize({
      database,
      pullChanges: emptyPull(1000),
      pushChanges: async () => {
        // this runs between fetchLocalChanges and markLocalChangesAsSynced
        // user modifies record
        await database.write(() =>
          task.update(() => {
            task.isCompleted = true
            task.position = 20
          }),
        )
      },
    })
    expect(task._raw).toMatchObject({
      _status: 'created',
      _changed: 'is_completed,position',
      position: 20,
      is_completed: true,
    })
    await synchronize({
      database,
      pullChanges: () => ({
        changes: makeChangeSet({
          mock_tasks: {
            // backend serves the pushed record back
            updated: [omit(['_changed', '_status'], initialRaw)],
          },
        }),
        timestamp: 1500,
      }),
      pushChanges: () => {
        expect(task._raw).toMatchObject({ _status: 'created', _changed: 'is_completed,position' })
      },
    })
    expect(task._raw).toMatchObject({
      _status: 'synced',
      _changed: '',
      position: 20,
      is_completed: true,
    })
  })
  it.skip(`can accept remote changes received during push`, async () => {
    // TODO: future improvement?
  })
  it.skip(`can resolve push-time sync conflicts`, async () => {
    // TODO: future improvement?
  })
  it.skip(`only emits one collection batch change`, async () => {
    // TODO: unskip when batch change emissions are implemented
  })
})
