import { expectToRejectWithMessage } from '../../../__tests__/utils'
import { makeDatabase, emptyPull } from './helpers'

import { synchronize } from '../../index'
import { getLastPulledAt } from '../index'

describe('synchronize - turbo', () => {
  it(`validates turbo sync settings`, async () => {
    const { database } = makeDatabase()

    await expectToRejectWithMessage(
      synchronize({
        database,
        pullChanges: () => ({ syncJson: '{}' }),
        unsafeTurbo: true,
        _unsafeBatchPerCollection: true,
      }),
      'unsafeTurbo must not be used with _unsafeBatchPerCollection',
    )

    await expectToRejectWithMessage(
      synchronize({ database, pullChanges: () => ({}), unsafeTurbo: true }),
      'missing syncJson/syncJsonId',
    )

    await synchronize({ database, pullChanges: emptyPull() })
    await expectToRejectWithMessage(
      synchronize({ database, pullChanges: () => ({ syncJson: '{} ' }), unsafeTurbo: true }),
      'unsafeTurbo can only be used as the first sync',
    )
  })
  it(`can pull with turbo login`, async () => {
    const { database, adapter } = makeDatabase()
    // FIXME: Test on real native db instead of mocking
    adapter.provideSyncJson = jest
      .fn()
      .mockImplementationOnce((id, json, callback) => callback({ value: true }))
    adapter.unsafeLoadFromSync = jest
      .fn()
      .mockImplementationOnce((id, callback) => callback({ value: { timestamp: 1011 } }))

    const json = '{ hello! }'
    const log = {}
    await synchronize({ database, pullChanges: () => ({ syncJson: json }), unsafeTurbo: true, log })

    expect(await getLastPulledAt(database)).toBe(1011)
    expect(log.lastPulledAt).toBe(null)
    expect(log.newLastPulledAt).toBe(1011)

    expect(adapter.provideSyncJson.mock.calls.length).toBe(1)
    const jsonId = adapter.provideSyncJson.mock.calls[0][0]
    expect(typeof jsonId).toBe('number')
    expect(adapter.provideSyncJson.mock.calls[0][1]).toBe(json)
    expect(adapter.unsafeLoadFromSync.mock.calls.length).toBe(1)
    expect(adapter.unsafeLoadFromSync.mock.calls[0][0]).toBe(jsonId)
  })
  it(`can pull with turbo login (using native id)`, async () => {
    const { database, adapter } = makeDatabase()
    // FIXME: Test on real native db instead of mocking
    adapter.provideSyncJson = jest.fn()
    adapter.unsafeLoadFromSync = jest
      .fn()
      .mockImplementationOnce((id, callback) => callback({ value: { timestamp: 1012 } }))

    const log = {}
    await synchronize({
      database,
      pullChanges: () => ({ syncJsonId: 2137 }),
      unsafeTurbo: true,
      log,
    })

    expect(await getLastPulledAt(database)).toBe(1012)
    expect(log.lastPulledAt).toBe(null)
    expect(log.newLastPulledAt).toBe(1012)

    expect(adapter.provideSyncJson.mock.calls.length).toBe(0)
    expect(adapter.unsafeLoadFromSync.mock.calls.length).toBe(1)
    expect(adapter.unsafeLoadFromSync.mock.calls[0][0]).toBe(2137)
  })
  describe('onDidPullChanges', () => {
    it(`calls onDidPullChanges`, async () => {
      const { database } = makeDatabase()

      const onDidPullChanges = jest.fn()
      await synchronize({
        database,
        pullChanges: () => ({ changes: {}, timestamp: 1000, hello: 'hi' }),
        onDidPullChanges,
      })
      expect(onDidPullChanges).toHaveBeenCalledTimes(1)
      expect(onDidPullChanges).toHaveBeenCalledWith({ timestamp: 1000, hello: 'hi' })
    })
    it(`calls onDidPullChanges in turbo`, async () => {
      const { database, adapter } = makeDatabase()
      // FIXME: Test on real native db instead of mocking
      adapter.unsafeLoadFromSync = jest
        .fn()
        .mockImplementationOnce((id, callback) =>
          callback({ value: { timestamp: 1000, hello: 'hi' } }),
        )

      const onDidPullChanges = jest.fn()
      await synchronize({
        database,
        pullChanges: () => ({ syncJsonId: 0 }),
        unsafeTurbo: true,
        onDidPullChanges,
      })
      expect(onDidPullChanges).toHaveBeenCalledTimes(1)
      expect(onDidPullChanges).toHaveBeenCalledWith({ timestamp: 1000, hello: 'hi' })
    })
  })
})
