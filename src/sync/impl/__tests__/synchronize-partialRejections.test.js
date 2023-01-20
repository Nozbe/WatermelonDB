import { makeDatabase, makeLocalChanges, makeChangeSet, emptyPull } from './helpers'

import { synchronize } from '../../index'
import { fetchLocalChanges } from '../index'

describe('synchronize - partial push rejections', () => {
  it(`can partially reject a push`, async () => {
    const { database } = makeDatabase()

    const { tCreated, tUpdated } = await makeLocalChanges(database)

    const rejectedIds = Object.freeze({
      mock_tasks: ['tCreated', 'tUpdated'],
      mock_comments: ['cDeleted'],
    })
    const log = {}
    await synchronize({
      database,
      pullChanges: jest.fn(emptyPull()),
      pushChanges: jest.fn(() => ({ experimentalRejectedIds: rejectedIds })),
      log,
    })
    expect((await fetchLocalChanges(database)).changes).toEqual(
      makeChangeSet({
        mock_tasks: { created: [tCreated._raw], updated: [tUpdated._raw] },
        mock_comments: { deleted: ['cDeleted'] },
      }),
    )
    expect(log.rejectedIds).toBe(rejectedIds)
  })
  it(`can partially reject a push and make changes during push`, async () => {
    const { database, comments } = makeDatabase()

    const { pCreated1, tUpdated } = await makeLocalChanges(database)
    const pCreated1Raw = { ...pCreated1._raw }
    let newComment
    await synchronize({
      database,
      pullChanges: jest.fn(emptyPull()),
      pushChanges: jest.fn(async () => {
        await database.write(async () => {
          await pCreated1.update((p) => {
            p.name = 'updated!'
          })
          newComment = await comments.create((c) => {
            c.body = 'bazinga'
          })
        })
        return {
          experimentalRejectedIds: {
            mock_tasks: ['tUpdated'],
            mock_comments: ['cDeleted'],
          },
        }
      }),
    })
    expect((await fetchLocalChanges(database)).changes).toEqual(
      makeChangeSet({
        mock_projects: { created: [{ ...pCreated1Raw, _changed: 'name', name: 'updated!' }] },
        mock_tasks: { updated: [tUpdated._raw] },
        mock_comments: { created: [newComment._raw], deleted: ['cDeleted'] },
      }),
    )
  })
})
