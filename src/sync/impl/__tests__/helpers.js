import { change } from 'rambdax'
import { allPromises } from '../../../utils/fp'
import { mockDatabase } from '../../../__tests__/testModels'
import { sanitizedRaw } from '../../../RawRecord'

export const makeDatabase = () => mockDatabase()

export const countAll = async (collections) => {
  const counts = await allPromises((collection) => collection.query().fetchCount(), collections)
  return counts.reduce((a, b) => a + b, 0)
}

export const allDeletedRecords = async (collections) => {
  const deletedRecords = await allPromises(
    (collection) => collection.database.adapter.getDeletedRecords(collection.table),
    collections,
  )
  return deletedRecords.flatMap((records) => records)
}

export const prepareCreateFromRaw = (collection, dirtyRaw) =>
  collection.prepareCreate((record) => {
    record._raw = sanitizedRaw({ _status: 'synced', ...dirtyRaw }, record.collection.schema)
  })

export const getRaw = (collection, id) =>
  collection.find(id).then(
    (record) => record._raw,
    () => null,
  )

export const expectSyncedAndMatches = async (collection, id, match) =>
  expect(await getRaw(collection, id)).toMatchObject({
    _status: 'synced',
    _changed: '',
    id,
    ...match,
  })
export const expectDoesNotExist = async (collection, id) =>
  expect(await getRaw(collection, id)).toBe(null)

export const emptyChangeSet = Object.freeze({
  mock_projects: { created: [], updated: [], deleted: [] },
  mock_project_sections: { created: [], updated: [], deleted: [] },
  mock_tasks: { created: [], updated: [], deleted: [] },
  mock_comments: { created: [], updated: [], deleted: [] },
})
export const emptyLocalChanges = Object.freeze({ changes: emptyChangeSet, affectedRecords: [] })

export const makeChangeSet = (set) => change(emptyChangeSet, '', set)

export const sorted = (models) => {
  const copy = models.slice()
  copy.sort((a, b) => {
    if (a.id < b.id) {
      return -1
    } else if (a.id > b.id) {
      return 1
    }
    return 0
  })
  return copy
}

export const makeLocalChanges = (database) =>
  database.write(async () => {
    const projects = database.get('mock_projects')
    const tasks = database.get('mock_tasks')
    const comments = database.get('mock_comments')

    // create records
    const created = (obj) => ({ _status: 'created', ...obj })
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
    await records.pUpdated.update((p) => {
      p.name = 'local'
    })
    await records.tUpdated.update((p) => {
      p.name = 'local'
      p.position = 100
    })
    await records.cUpdated.update((c) => {
      c.body = 'local'
    })
    await records.tDeleted.update((t) => {
      t.name = 'local'
    })

    // delete records
    await records.pDeleted.markAsDeleted()
    await records.tDeleted.markAsDeleted()
    await records.cDeleted.markAsDeleted()
    await records.cDestroyed.destroyPermanently() // sanity check

    return records
  })

export const emptyPull =
  (timestamp = 1500) =>
  async () => ({ changes: emptyChangeSet, timestamp })
