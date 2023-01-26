import { expectToRejectWithMessage } from '../../../__tests__/utils'
import { makeDatabase, makeLocalChanges, makeChangeSet, emptyPull } from './helpers'

import { synchronize } from '../../index'
import { getLastPulledAt } from '../index'

describe('synchronize - aborts', () => {
  it('aborts on concurrent synchronization', async () => {
    const { database } = makeDatabase()

    const delayPromise = (delay) =>
      new Promise((resolve) => {
        setTimeout(resolve, delay)
      })
    const syncWithDelay = (delay) =>
      synchronize({
        database,
        pullChanges: () => delayPromise(delay).then(emptyPull(delay)),
        pushChanges: jest.fn(),
      })

    const sync1 = syncWithDelay(100)
    const sync2 = syncWithDelay(300).catch((error) => error)

    expect(await sync1).toBe(undefined)
    expect(await sync2).toMatchObject({ message: expect.stringMatching(/concurrent sync/i) })
    expect(await getLastPulledAt(database)).toBe(100)
  })
  it('aborts if database is cleared during sync', async () => {
    const { database, projects } = makeDatabase()
    const pushChanges = jest.fn()
    await expectToRejectWithMessage(
      synchronize({
        database,
        pullChanges: jest.fn(async () => {
          await database.write(() => database.unsafeResetDatabase())
          return {
            changes: makeChangeSet({
              mock_projects: {
                created: [{ id: 'new_project', name: 'remote' }],
              },
            }),
            timestamp: 1500,
          }
        }),
        pushChanges,
      }),
      'database was reset',
    )
    await expectToRejectWithMessage(projects.find('new_project'), 'not found')
    expect(pushChanges).not.toHaveBeenCalled()
  })
  it('aborts if database is cleared during sync — different case', async () => {
    const { database, projects } = makeDatabase()
    await makeLocalChanges(database) // make changes so pushChanges is called
    await expectToRejectWithMessage(
      synchronize({
        database,
        pullChanges: () => ({
          changes: makeChangeSet({
            mock_projects: {
              created: [{ id: 'new_project', name: 'remote' }],
            },
          }),
          timestamp: 1500,
        }),
        pushChanges: () => database.write(() => database.unsafeResetDatabase()),
      }),
      'database was reset',
    )
    await expectToRejectWithMessage(projects.find('new_project'), 'not found')
  })
})
