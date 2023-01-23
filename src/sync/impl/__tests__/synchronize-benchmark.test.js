import { times, map, length } from 'rambdax'
import { noop } from '../../../utils/fp'
import { randomId } from '../../../utils/common'
import {
  makeDatabase,
  emptyLocalChanges,
  makeChangeSet,
  prepareCreateFromRaw,
  countAll,
  getRaw,
} from './helpers'

import { synchronize, hasUnsyncedChanges } from '../../index'
import { fetchLocalChanges } from '../index'

describe('synchronize - benchmark', () => {
  it('can synchronize lots of data', async () => {
    const { database, projects, tasks, comments } = makeDatabase()

    // TODO: This is kinda useless right now, but would make a great fuzz test or a benchmark

    // local changes
    const sample = 500
    await database.write(async () => {
      const createdProjects = times(() => projects.prepareCreate(noop), sample)
      const updatedTasks = times(() => prepareCreateFromRaw(tasks, { id: randomId() }), sample)
      const deletedComments = times(
        () => prepareCreateFromRaw(comments, { id: randomId() }),
        sample,
      )
      await database.batch(...createdProjects, ...updatedTasks, ...deletedComments)
      await database.batch(
        ...updatedTasks.map((task) =>
          task.prepareUpdate(() => {
            task.name = 'x'
          }),
        ),
      )
      await database.batch(...deletedComments.map((comment) => comment.prepareMarkAsDeleted()))
    })

    // remote changes
    const pullChanges = jest.fn(async () => ({
      changes: makeChangeSet({
        mock_projects: {
          deleted: times(() => randomId(), sample),
        },
        mock_tasks: {
          created: times(() => ({ id: randomId() }), sample),
        },
      }),
      timestamp: 1500,
    }))
    const pushChanges = jest.fn()

    // check
    // TODO: Remove the flag -- temporarily taking over this test to test _unsafeBatchPerCollection
    await synchronize({ database, pullChanges, pushChanges, _unsafeBatchPerCollection: true })

    expect(await projects.query().fetchCount()).toBe(sample) // local
    expect(await tasks.query().fetchCount()).toBe(sample + sample) // local + remote
    expect(await comments.query().fetchCount()).toBe(0) // all deleted

    expect(await fetchLocalChanges(database)).toEqual(emptyLocalChanges)
    expect(await hasUnsyncedChanges({ database })).toBe(false)
    const pushedChanges = pushChanges.mock.calls[0][0].changes
    const pushedCounts = map(map(length), pushedChanges)
    expect(pushedCounts).toEqual({
      mock_projects: { created: sample, updated: 0, deleted: 0 },
      mock_project_sections: { created: 0, updated: 0, deleted: 0 },
      mock_tasks: { created: 0, updated: sample, deleted: 0 },
      mock_comments: { created: 0, updated: 0, deleted: sample },
    })
  })
  it(`can run a large replacement sync`, async () => {
    const { database, tasks } = makeDatabase()

    const sample = 500
    const unchanged = times(() => ({ id: randomId() }), sample)
    const modified = times(() => ({ id: randomId() }), sample)
    const deleted = times(() => ({ id: randomId() }), sample)

    // create local changes
    await database.write(async () => {
      await database.batch(
        ...unchanged.map((raw) => prepareCreateFromRaw(tasks, raw)),
        ...modified.map((raw) =>
          prepareCreateFromRaw(tasks, {
            ...raw,
            _status: 'updated',
            _changed: 'name',
            name: 'local',
            description: 'orig',
          }),
        ),
        ...deleted.map((raw) => prepareCreateFromRaw(tasks, raw)),
      )
    })
    expect(await countAll([tasks])).toBe(3 * sample) // sanity check

    // run replacement (with the same data, there should be no changes)
    await synchronize({
      database,
      pullChanges: async () => ({
        changes: makeChangeSet({
          mock_tasks: {
            updated: [
              ...unchanged,
              ...modified.map((raw) => ({ ...raw, name: 'remote', description: 'remote' })),
            ],
          },
        }),
        timestamp: 1500,
        experimentalStrategy: 'replacement',
      }),
      pushChanges: jest.fn(),
    })

    // sanity checks
    expect(await countAll([tasks])).toBe(2 * sample)
    expect(await getRaw(tasks, modified[0].id)).toMatchObject({
      _status: 'synced',
      name: 'local',
      description: 'remote',
    })
  })
})
