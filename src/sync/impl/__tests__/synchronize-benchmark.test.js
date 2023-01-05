import { times, map, length } from 'rambdax'
import { noop } from '../../../utils/fp'
import { randomId } from '../../../utils/common'
import { makeDatabase, emptyLocalChanges, makeChangeSet, prepareCreateFromRaw } from './helpers'

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
})
