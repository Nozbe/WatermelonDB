import {
  makeDatabase,
  emptyLocalChanges,
  emptyChangeSet,
  allDeletedRecords,
  expectSyncedAndMatches,
  getRaw,
  makeLocalChanges,
  makeChangeSet,
  sorted,
} from './helpers'

import { fetchLocalChanges, markLocalChangesAsSynced } from '../index'

describe('markLocalChangesAsSynced', () => {
  it('does nothing for empty local changes', async () => {
    const { database } = makeDatabase()

    const destroyDeletedRecordsSpy = jest.spyOn(database.adapter, 'destroyDeletedRecords')

    await makeLocalChanges(database)
    const localChanges1 = await fetchLocalChanges(database)

    await markLocalChangesAsSynced(database, { changes: emptyChangeSet, affectedRecords: [] })

    const localChanges2 = await fetchLocalChanges(database)
    expect(localChanges1).toEqual(localChanges2)

    // Should NOT call `database.adapter.destroyDeletedRecords` if no records present
    expect(destroyDeletedRecordsSpy).toHaveBeenCalledTimes(0)
  })
  it('marks local changes as synced', async () => {
    const { database, projects, tasks, comments } = makeDatabase()

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
    expect(projectList.every((record) => record.syncStatus === 'synced')).toBe(true)
    expect(taskList.every((record) => record.syncStatus === 'synced')).toBe(true)

    // no objects marked as deleted
    expect(await allDeletedRecords([projects, tasks, comments])).toEqual([])
  })
  it(`doesn't modify updated_at timestamps`, async () => {
    const { database, comments } = makeDatabase()

    await makeLocalChanges(database)
    const updatedAt = (await getRaw(comments, 'cUpdated')).updated_at
    await markLocalChangesAsSynced(database, await fetchLocalChanges(database))

    await expectSyncedAndMatches(comments, 'cCreated', { created_at: 1000, updated_at: 2000 })
    await expectSyncedAndMatches(comments, 'cUpdated', { created_at: 1000, updated_at: updatedAt })
    await expectSyncedAndMatches(comments, 'cSynced', { created_at: 1000, updated_at: 2000 })
  })
  it(`doesn't mark as synced records that changed since changes were fetched`, async () => {
    const { database, projects, tasks } = makeDatabase()

    const destroyDeletedRecordsSpy = jest.spyOn(database.adapter, 'destroyDeletedRecords')

    const { pSynced, tSynced, tCreated, tUpdated, cSynced, cCreated, cUpdated, cDeleted } =
      await makeLocalChanges(database)
    const localChanges = await fetchLocalChanges(database)

    // simulate user making changes the the app while sync push request is in progress
    let newProject
    await database.write(async () => {
      // non-confliting changes: new record, update synced record, delete synced record
      newProject = await projects.create()
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
    })
    expect(destroyDeletedRecordsSpy).toHaveBeenCalledTimes(0)

    // mark local changes as synced; check if new changes are still pending sync
    await markLocalChangesAsSynced(database, localChanges)
    expect(destroyDeletedRecordsSpy).toHaveBeenCalledTimes(3)
    expect(destroyDeletedRecordsSpy).toHaveBeenCalledWith('mock_projects', ['pDeleted'])
    expect(destroyDeletedRecordsSpy).toHaveBeenCalledWith('mock_tasks', ['tDeleted'])
    expect(destroyDeletedRecordsSpy).toHaveBeenCalledWith('mock_comments', ['cDeleted'])
    destroyDeletedRecordsSpy.mockClear()

    const localChanges2 = await fetchLocalChanges(database)
    expect(localChanges2.changes).toEqual(
      makeChangeSet({
        mock_projects: { created: [newProject._raw], updated: [pSynced._raw] },
        mock_tasks: { created: [tCreated._raw], updated: [tUpdated._raw], deleted: ['tSynced'] },
        mock_comments: { deleted: ['cUpdated', 'cCreated'] },
      }),
    )
    expect(sorted(localChanges2.affectedRecords)).toEqual(
      sorted([newProject, tCreated, pSynced, tUpdated]),
    )
    expect(destroyDeletedRecordsSpy).toHaveBeenCalledTimes(0)

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
    expect(destroyDeletedRecordsSpy).toHaveBeenCalledTimes(2)
    expect(await fetchLocalChanges(database)).toEqual(emptyLocalChanges)

    expect(destroyDeletedRecordsSpy).toHaveBeenCalledTimes(2)
    expect(destroyDeletedRecordsSpy).toHaveBeenCalledWith('mock_tasks', ['tSynced'])
    expect(destroyDeletedRecordsSpy).toHaveBeenCalledWith('mock_comments', ['cUpdated', 'cCreated'])
  })
  it(`doesn't mark as synced records in the rejectedIds object`, async () => {
    const { database, comments } = makeDatabase()

    const { pCreated1, pUpdated } = await makeLocalChanges(database)
    const localChanges = await fetchLocalChanges(database)

    // mark as synced
    await markLocalChangesAsSynced(database, localChanges, {
      mock_projects: ['pCreated1', 'pUpdated'],
      mock_comments: ['cDeleted'],
    })

    // verify
    const localChanges2 = await fetchLocalChanges(database)
    expect(localChanges2.changes).toEqual(
      makeChangeSet({
        mock_projects: { created: [pCreated1._raw], updated: [pUpdated._raw] },
        mock_comments: { deleted: ['cDeleted'] },
      }),
    )
    expect(await allDeletedRecords([comments])).toEqual(['cDeleted'])
  })
  it(`can mark records as synced when ids are per-table not globally unique`, async () => {
    const { database, projects, tasks, comments } = makeDatabase()

    await makeLocalChanges(database)
    await database.write(async () => {
      await database.batch(
        projects.prepareCreateFromDirtyRaw({ id: 'hello' }),
        tasks.prepareCreateFromDirtyRaw({ id: 'hello' }),
        comments.prepareCreateFromDirtyRaw({ id: 'hello' }),
      )
    })

    await markLocalChangesAsSynced(database, await fetchLocalChanges(database))

    // no more changes
    expect(await fetchLocalChanges(database)).toEqual(emptyLocalChanges)
  })
  // TODO: Unskip the test when batch collection emissions are implemented
  it.skip('only emits one collection batch change', async () => {
    const { database, projects } = makeDatabase()

    const { pCreated1 } = await makeLocalChanges(database)
    const localChanges = await fetchLocalChanges(database)

    const projectsObserver = jest.fn()
    projects.changes.subscribe(projectsObserver)

    await markLocalChangesAsSynced(database, localChanges)

    expect(projectsObserver).toHaveBeenCalledTimes(1)
    expect(projectsObserver).toHaveBeenCalledWith([
      { type: 'created', record: pCreated1 },
      // TODO: missing changes + changes in other collections
    ])
  })
  it.skip(`doesn't send _status, _changed fields`, async () => {
    // TODO: Future improvement
  })
  it.skip('only returns changed fields', async () => {
    // TODO: Possible future improvement?
  })
})
