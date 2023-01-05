import { expectToRejectWithMessage } from '../../../__tests__/utils'
import {
  makeDatabase,
  allDeletedRecords,
  countAll,
  getRaw,
  makeLocalChanges,
  makeChangeSet,
} from './helpers'

import { synchronize } from '../../index'

describe('synchronize - replacement syncs', () => {
  it('can synchronize using replacement strategy', async () => {
    const { database, projects, tasks, comments } = makeDatabase()

    await makeLocalChanges(database)

    const pullChanges = async () => ({
      changes: makeChangeSet({
        mock_projects: {
          updated: [
            // no changes, keep
            { id: 'pSynced' },
          ],
        },
        mock_tasks: {
          updated: [
            // update
            { id: 'tSynced', name: 'remote', description: 'remote' },
            // create
            { id: 'new_task', name: 'remote' },
          ],
        },
      }),
      timestamp: 1500,
      experimentalStrategy: 'replacement',
    })
    const pushChanges = jest.fn()
    const log = {}
    await synchronize({ database, pullChanges, pushChanges, sendCreatedAsUpdated: true, log })

    // check replacement behavior
    expect(await getRaw(tasks, 'tSynced')).toMatchObject({
      _status: 'synced',
      _changed: '',
      name: 'remote',
    })
    expect(await countAll([projects, tasks, comments])).toBe(3 + 4) // dataset + created
    expect(await allDeletedRecords([projects, tasks, comments])).toEqual([])

    // expect 4 created records to be sent
    expect(pushChanges).toHaveBeenCalledTimes(1)
    expect(log.localChangeCount).toBe(4)
  })
  it(`fails on incorrect strategy`, async () => {
    const { database } = makeDatabase()

    const pullChanges = async () => ({
      changes: makeChangeSet({}),
      timestamp: 1500,
      experimentalStrategy: 'replace',
    })
    await expectToRejectWithMessage(
      synchronize({ database, pullChanges, pushChanges: jest.fn() }),
      'Invalid pull strategy',
    )
  })
})
