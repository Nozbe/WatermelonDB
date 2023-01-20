import clone from 'lodash.clonedeep'
import { makeDatabase, emptyLocalChanges, makeLocalChanges, makeChangeSet } from './helpers'

import { fetchLocalChanges } from '../index'
import { hasUnsyncedChanges } from '../../index'

describe('fetchLocalChanges', () => {
  it('returns empty object if no changes', async () => {
    const { database } = makeDatabase()
    expect(await fetchLocalChanges(database)).toEqual(emptyLocalChanges)
  })
  it('fetches all local changes', async () => {
    // eslint-disable-next-line
    let { database, cloneDatabase } = makeDatabase()

    const { pCreated1, pCreated2, pUpdated, tCreated, tUpdated, tDeleted, cCreated, cUpdated } =
      await makeLocalChanges(database)

    // check
    expect(pCreated1._raw._status).toBe('created')
    expect(pUpdated._raw._status).toBe('updated')
    expect(pUpdated._raw._changed).toBe('name')

    expect(tDeleted._raw._status).toBe('deleted')
    const expectedChanges = clone(
      makeChangeSet({
        mock_projects: {
          created: [pCreated2._raw, pCreated1._raw],
          updated: [pUpdated._raw],
          deleted: ['pDeleted'],
        },
        mock_tasks: { created: [tCreated._raw], updated: [tUpdated._raw], deleted: ['tDeleted'] },
        mock_comments: {
          created: [cCreated._raw],
          updated: [cUpdated._raw],
          deleted: ['cDeleted'],
        },
      }),
    )
    const expectedAffectedRecords = [
      pCreated2,
      pCreated1,
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
    database = await cloneDatabase()
    const result2 = await fetchLocalChanges(database)
    expect(result2.changes).toEqual(expectedChanges)
    expect(result2.affectedRecords.map((r) => r._raw)).toEqual(
      expectedAffectedRecords.map((r) => r._raw),
    )
  })
  it('returns object copies', async () => {
    const { database } = makeDatabase()

    const { pUpdated } = await makeLocalChanges(database)

    const { changes } = await fetchLocalChanges(database)
    const changesCloned = clone(changes)

    // raws should be cloned - further changes don't affect result
    await database.write(() =>
      pUpdated.update((p) => {
        p.name = 'y'
      }),
    )
    expect(changes).toEqual(changesCloned)
  })
})

describe('hasUnsyncedChanges', () => {
  it('has no unsynced changes by default', async () => {
    const { database } = makeDatabase()
    expect(await hasUnsyncedChanges({ database })).toBe(false)
  })
  it('has unsynced changes if made', async () => {
    const { database } = makeDatabase()
    await makeLocalChanges(database)
    expect(await hasUnsyncedChanges({ database })).toBe(true)
  })
  it('just one update is enough', async () => {
    const { database } = makeDatabase()
    const collection = database.get('mock_comments')
    const record = await database.write(() =>
      collection.create((rec) => {
        rec._raw._status = 'synced'
      }),
    )

    expect(await hasUnsyncedChanges({ database })).toBe(false)

    await database.write(async () => {
      await record.update(() => {
        record.body = 'changed'
      })
    })

    expect(await hasUnsyncedChanges({ database })).toBe(true)
  })
  it('just one delete is enough', async () => {
    const { database } = makeDatabase()
    const collection = database.get('mock_comments')
    const record = await database.write(() =>
      collection.create((rec) => {
        rec._raw._status = 'synced'
      }),
    )

    expect(await hasUnsyncedChanges({ database })).toBe(false)

    await database.write(() => record.markAsDeleted())

    expect(await hasUnsyncedChanges({ database })).toBe(true)
  })
})
