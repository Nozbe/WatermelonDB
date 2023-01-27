import { omit } from 'rambdax'
import { expectToRejectWithMessage } from '../../../__tests__/utils'
import * as Q from '../../../QueryDescription'
import {
  makeDatabase,
  emptyLocalChanges,
  emptyChangeSet,
  allDeletedRecords,
  countAll,
  allIds,
  expectSyncedAndMatches,
  getRaw,
  makeLocalChanges,
  makeChangeSet,
  expectDoesNotExist,
  prepareCreateFromRaw,
} from './helpers'

import { fetchLocalChanges, applyRemoteChanges } from '../index'

const testApplyRemoteChanges = (db, set, extraContext = {}) =>
  db.write(() => applyRemoteChanges(makeChangeSet(set), { db, ...extraContext }))

describe('applyRemoteChanges', () => {
  it('does nothing if no remote changes', async () => {
    const { database } = makeDatabase()

    await makeLocalChanges(database)
    const localChanges1 = await fetchLocalChanges(database)

    await database.write(() => applyRemoteChanges(emptyChangeSet, { db: database }))

    const localChanges2 = await fetchLocalChanges(database)
    expect(localChanges1).toEqual(localChanges2)
  })
  // Note: We need to test all possible status combinations - xproduct of:
  // remote: created/updated/deleted
  // local: synced/created/updated/deleted/doesn't exist
  // (15 cases)
  it('can create, update, delete records', async () => {
    const { database, projects, tasks, comments } = makeDatabase()

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
    const { database, tasks, comments } = makeDatabase()

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
    const { database, projects } = makeDatabase()

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
    const { database, tasks } = makeDatabase()

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
    const { database, projects, tasks } = makeDatabase()

    await makeLocalChanges(database)
    await testApplyRemoteChanges(database, {
      mock_projects: {
        created: [
          // create / created - very weird case. resolve and update
          // this and update/created could happen if app crashes after pushing
          { id: 'pCreated1', name: 'remote' },
        ],
      },
      mock_tasks: {
        updated: [
          // update / created - very weird. resolve and update
          { id: 'tCreated', name: 'remote' },
          // update / doesn't exist - create (stay synced)
          { id: 'does_not_exist', name: 'remote' },
        ],
      },
    })

    expect(await getRaw(projects, 'pCreated1')).toMatchObject({
      _status: 'created',
      _changed: '',
      name: 'remote',
    })
    expect(await getRaw(tasks, 'tCreated')).toMatchObject({
      _status: 'created',
      _changed: '',
      name: 'remote',
    })
    await expectSyncedAndMatches(tasks, 'does_not_exist', { name: 'remote' })
  })
  describe('replacement sync', () => {
    it(`can clear database using replacement strategy`, async () => {
      const { database, projects, tasks, comments } = makeDatabase()

      // create only synced/updated records
      await database.write(async () => {
        await database.batch(
          prepareCreateFromRaw(projects, { id: 'p1', name: 'orig' }),
          prepareCreateFromRaw(tasks, {
            id: 't1',
            _status: 'updated',
            _updated: 'name',
            name: 'local',
          }),
        )
      })

      expect(await countAll([projects, tasks, comments])).toBe(2)

      await testApplyRemoteChanges(database, {}, { strategy: 'replacement' })
      expect(await countAll([projects, tasks, comments])).toBe(0)
      expect(await allDeletedRecords([projects, tasks, comments])).toEqual([])
    })
    it(`can clear database using replacement strategy (but locally created are preserved)`, async () => {
      const { database, projects, tasks, comments } = makeDatabase()

      await makeLocalChanges(database)
      expect(await countAll([projects, tasks, comments])).toBe(10)

      await testApplyRemoteChanges(database, {}, { strategy: 'replacement' })
      expect(await countAll([projects, tasks, comments])).toBe(4)
      expect(await allDeletedRecords([projects, tasks, comments])).toEqual([])
    })
    it(`can apply changes using replacement strategy`, async () => {
      const { database, projects, tasks, comments } = makeDatabase()

      await makeLocalChanges(database)
      await testApplyRemoteChanges(
        database,
        {
          mock_projects: {
            created: [
              // same as local
              { id: 'pSynced' },
              // created / created - resolve and update
              { id: 'pCreated1' },
              // newly created by remote
              { id: 'new_project', name: 'remote' },
            ],
            updated: [
              // updated / created - resolve and update
              { id: 'pCreated2', name: 'remote' },
              // updated / updated - resolve and update (actually no remote change)
              { id: 'pUpdated', name: 'remote' },
            ],
          },
          mock_tasks: {
            created: [
              // created / updated - resolve and update
              { id: 'tUpdated', name: 'remote', description: 'remote' },
            ],
          },
          mock_comments: {
            deleted: [
              // explicit deletions aren't disallowed when doing replacement strategy
              // (but pointless unless you do replacement per-collection)
              'cUpdated',
              'cDeleted',
              'cDestroyed',
              'cDoesNotExist',
              // exception: if record is created locally, it wouldn't be deleted if not in this list
              // (weird edge that shouldn't happen, but it's not incorrect - if first replacement sync failed to mark
              // records as synced after push, but were received by server and added to list of records to push-delete,
              // then this could theoretically happen)
              'cCreated',
            ],
          },
        },
        { strategy: 'replacement' },
      )

      await expectSyncedAndMatches(projects, 'pSynced', {})
      expect(await getRaw(projects, 'pCreated1')).toMatchObject({
        _status: 'created',
        _changed: '',
        name: '',
      })
      await expectSyncedAndMatches(projects, 'new_project', { name: 'remote' })
      expect(await getRaw(projects, 'pCreated2')).toMatchObject({
        _status: 'created',
        _changed: '',
        name: 'remote',
      })
      expect(await getRaw(projects, 'pUpdated')).toMatchObject({
        _status: 'updated',
        _changed: 'name',
        name: 'local',
      })
      expect(await getRaw(tasks, 'tUpdated')).toMatchObject({
        _status: 'updated',
        _changed: 'name,position',
        name: 'local',
        position: 100,
        description: 'remote',
        project_id: 'orig',
      })

      // everything else is deleted
      await expectDoesNotExist(comments, 'cSynced')
      await expectDoesNotExist(comments, 'cUpdated')
      const recordsInDataset = 6
      const createdRecordsKept = 1 // tCreated. pCreated1/pCreated2 are in dataset, cCreated is explicitly deleted
      expect(await countAll([projects, tasks, comments])).toBe(
        recordsInDataset + createdRecordsKept,
      )
      expect(await allDeletedRecords([projects, tasks, comments])).toEqual([])
    })
    it(`can apply changes using replacement with per-table granularity`, async () => {
      const { database, projects, tasks, comments } = makeDatabase()

      await makeLocalChanges(database)
      await testApplyRemoteChanges(
        database,
        {
          mock_projects: {
            updated: [
              // same as local
              { id: 'pSynced' },
              // newly created by remote
              { id: 'new_project', name: 'remote' },
            ],
          },
          mock_tasks: {
            created: [{ id: 'new_task' }],
          },
        },
        {
          strategy: {
            default: 'incremental',
            override: {
              mock_projects: 'replacement',
            },
          },
        },
      )

      // projects are replaced
      expect(await countAll([projects])).toBe(2 + 2) // 2 in dataset, 2 created locally
      expect(await allDeletedRecords([projects])).toEqual([])

      // tasks, comments are incremental
      expect(await countAll([tasks, comments])).toBe(4 + 3)
      expect(await allDeletedRecords([tasks, comments])).toEqual(['tDeleted', 'cDeleted'])
    })
    it(`can apply changes using partial replacement`, async () => {
      const { database, projects, tasks, comments } = makeDatabase()

      await database.write(async () => {
        const recs = [
          // records in the "needs replacement" segment
          prepareCreateFromRaw(tasks, { id: '1', project_id: 'deleted' }), // deleted remotely
          prepareCreateFromRaw(tasks, { id: '2', project_id: 'deleted' }), // deleted remotely
          prepareCreateFromRaw(tasks, { id: '2_del', project_id: 'deleted' }), // deleted remotely and locally
          prepareCreateFromRaw(tasks, { id: '3', project_id: 'permsChanged' }), // unchanged
          prepareCreateFromRaw(tasks, {
            id: '3b',
            _status: 'updated',
            _changed: 'name',
            project_id: 'permsChanged',
            name: 'local',
          }), // updated remotely
          prepareCreateFromRaw(tasks, { id: '3_del', project_id: 'permsChanged' }), // locally deleted
          prepareCreateFromRaw(tasks, { id: '4', project_id: 'permsChanged' }), // lost access (deleted)
          prepareCreateFromRaw(tasks, { id: '5', _status: 'created', project_id: 'deleted' }),

          // other records, that will be processed incrementally
          prepareCreateFromRaw(tasks, { id: 'a', project_id: 'foo' }), // deleted remotely
          prepareCreateFromRaw(tasks, { id: 'b', project_id: 'foo' }), // updated remotely
          prepareCreateFromRaw(tasks, { id: 'c', project_id: 'bar' }), // unchanged
          prepareCreateFromRaw(tasks, { id: 'c1', _status: 'updated', project_id: 'bar' }), // unchanged
          prepareCreateFromRaw(tasks, { id: 'c_del' }), // locally deleted
          prepareCreateFromRaw(tasks, { id: 'd', _status: 'created', project_id: 'baz' }), // created locally
        ]
        await database.batch(recs)
        await recs.find((rec) => rec.id === '2_del').markAsDeleted()
        await recs.find((rec) => rec.id === '3_del').markAsDeleted()
        await recs.find((rec) => rec.id === 'c_del').markAsDeleted()
        return recs
      })

      await testApplyRemoteChanges(
        database,
        {
          mock_tasks: {
            updated: [
              // replacement segment
              { id: '3', project_id: 'permsChanged' }, // unchanged
              { id: '3b', project_id: 'permsChanged', name: 'orig' }, // unchanged (but updated locally)
              { id: '3_del', project_id: 'permsChanged' }, // unchanged (but deleted locally)
              { id: '6', project_id: 'permsChanged' }, // new
              // incremental changes
              { id: 'b', name: 'remote' },
              { id: 'e' }, // new
            ],
            deleted: ['a'],
          },
        },
        {
          strategy: {
            default: 'replacement',
            override: {},
            experimentalQueryRecordsForReplacement: {
              mock_tasks: () => [Q.where('project_id', Q.oneOf(['deleted', 'permsChanged']))],
            },
          },
        },
      )

      // check results
      expect((await allIds([tasks])).sort()).toEqual(
        [
          // replacement
          '3',
          '3b',
          '5',
          '6',
          // incremental
          'b',
          'c',
          'c1',
          'd',
          'e',
        ].sort(),
      )
      expect(await getRaw(tasks, 'b')).toMatchObject({ name: 'remote' })
      expect(await getRaw(tasks, '3b')).toMatchObject({ _status: 'updated', name: 'local' })
      expect(await allDeletedRecords([tasks])).toEqual([
        'c_del', // kept (not in replacement segment)
        // 2_del not kept (in replacement segment, but not in dataset)
        '3_del', // kept (in dataset, needs to be pushed)
      ])

      expect(await countAll([projects, comments])).toBe(0)
    })
  })
  describe('timestamp management', () => {
    it(`doesn't touch created_at/updated_at when applying updates`, async () => {
      const { database, comments } = makeDatabase()

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
      const { database, comments } = makeDatabase()

      await makeLocalChanges(database)
      await testApplyRemoteChanges(database, {
        mock_comments: {
          created: [{ id: 'cNew', created_at: 1, updated_at: 2 }],
          updated: [{ id: 'cSynced', created_at: 10, updated_at: 20 }],
        },
      })

      await expectSyncedAndMatches(comments, 'cNew', { created_at: 1, updated_at: 2, body: '' })
      await expectSyncedAndMatches(comments, 'cSynced', {
        created_at: 10,
        updated_at: 20,
        body: '',
      })
    })
  })
  it.skip(`doesn't destroy dependent objects`, async () => {
    // TODO: Add this test when fast delete is implemented
  })
  it.skip('only emits one collection batch change', async () => {
    // TODO: Implement and unskip test when batch change emissions are implemented
  })
  it('rejects invalid records', async () => {
    const { database } = makeDatabase()

    const expectChangeFails = (changes) =>
      expectToRejectWithMessage(
        testApplyRemoteChanges(database, { mock_projects: changes }),
        /invalid raw record/i,
      )

    const expectCreateFails = (raw) => expectChangeFails({ created: [raw] })
    const expectUpdateFails = (raw) => expectChangeFails({ updated: [raw] })

    await expectCreateFails({ id: 'foo', _status: 'created' })
    await expectCreateFails({ id: 'foo', _changed: 'bla' })
    await expectCreateFails({ foo: 'bar' })

    await expectUpdateFails({ id: 'foo', _status: 'created' })
    await expectUpdateFails({ id: 'foo', _changed: 'bla' })
    await expectUpdateFails({ foo: 'bar' })

    expect(await fetchLocalChanges(database)).toEqual(emptyLocalChanges)
  })
  it(`safely skips collections that don't exist`, async () => {
    const { database } = makeDatabase()

    await testApplyRemoteChanges(database, { invalid_project: { created: [{ id: 'foo' }] } })
    await testApplyRemoteChanges(database, { __proto__: { created: [{ id: 'foo' }] } }) // oof, naughty
  })
  it(`doesn't currupt RecordCache (regression test)`, async () => {
    // eslint-disable-next-line
    let { database, cloneDatabase } = makeDatabase()

    const { tSynced } = await makeLocalChanges(database)

    // simulate reload
    database = await cloneDatabase()

    // touch tSynced, but don't actually create its JS model
    const previousRaw = omit(['_status', '_changed'], tSynced._raw)
    await testApplyRemoteChanges(database, {
      mock_tasks: {
        updated: [{ id: 'tSynced', ...previousRaw }],
      },
    })

    // Now actually fetch tSynced to trigger RecordCache corruption
    //   Record ID mock_tasks#tSynced was sent over the bridge, but it's not cached
    await database.get('mock_tasks').find('tSynced')
  })
})
