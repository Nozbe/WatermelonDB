// @flow

import { invariant } from '../../utils/common'

import {
  applyRemoteChanges,
  fetchLocalChanges,
  markLocalChangesAsSynced,
  getLastPulledAt,
  setLastPulledAt,
  setLastPulledSchemaVersion,
  getMigrationInfo,
} from './index'
import { ensureSameDatabase, isChangeSetEmpty, changeSetCount } from './helpers'
import type { SyncArgs, Timestamp, SyncPullStrategy } from '../index'

async function* liftToAsyncGenerator<T>(promise: Promise<T>): AsyncGenerator<T, void, void> {
  yield await promise
}

export default async function synchronize(params: SyncArgs): Promise<void> {
  const {
    database,
    onWillApplyRemoteChanges,
    onDidPullChanges,
    pushChanges,
    sendCreatedAsUpdated = false,
    migrationsEnabledAtVersion,
    log,
    conflictResolver,
    _unsafeBatchPerCollection,
    unsafeTurbo,
  } = params
  const resetCount = database._resetCount
  log && (log.startedAt = new Date())
  log && (log.phase = 'starting')

  // TODO: Wrap the three computionally intensive phases in `requestIdleCallback`

  // pull phase
  const lastPulledAt = await getLastPulledAt(database)
  log && (log.lastPulledAt = lastPulledAt)

  const { schemaVersion, migration, shouldSaveSchemaVersion } = await getMigrationInfo(
    database,
    log,
    lastPulledAt,
    migrationsEnabledAtVersion,
  )
  log && (log.phase = 'ready to pull')

  // $FlowFixMe
  const pullChunks = params.useUnsafeChunkedAsyncGenerator
    ? params.pullChanges({ lastPulledAt, schemaVersion, migration })
    : liftToAsyncGenerator(params.pullChanges({ lastPulledAt, schemaVersion, migration }))
    

  let newLastPulledAt: Timestamp | null = null
  let result = await pullChunks.next()
  log && (log.phase = 'pulled')

  // To answer your question - yes it would be nice to use a for await loop here
  // however, because of the use of 'fast-async' (see babel config), this syntax is *not* supported and will cause the code to hang...
  while(!result.done) {
    const pullResult = result.value
    let chunkNewLastPulledAt: Timestamp = (pullResult: any).timestamp
    newLastPulledAt = chunkNewLastPulledAt
    const remoteChangeCount = pullResult.changes ? changeSetCount(pullResult.changes) : NaN

    if (onWillApplyRemoteChanges) {
      await onWillApplyRemoteChanges({ remoteChangeCount })
    }

    await database.write(async () => {
      ensureSameDatabase(database, resetCount)
      invariant(
        lastPulledAt === (await getLastPulledAt(database)),
        '[Sync] Concurrent synchronization is not allowed. More than one synchronize() call was running at the same time, and the later one was aborted before committing results to local database.',
      )

      if (unsafeTurbo) {
        invariant(
          !_unsafeBatchPerCollection,
          'unsafeTurbo must not be used with _unsafeBatchPerCollection',
        )
        invariant(
          'syncJson' in pullResult || 'syncJsonId' in pullResult,
          'missing syncJson/syncJsonId',
        )
        invariant(lastPulledAt === null, 'unsafeTurbo can only be used as the first sync')

        const syncJsonId = pullResult.syncJsonId || Math.floor(Math.random() * 1000000000)

        if (pullResult.syncJson) {
          await database.adapter.provideSyncJson(syncJsonId, pullResult.syncJson)
        }

        const resultRest = await database.adapter.unsafeLoadFromSync(syncJsonId)
        chunkNewLastPulledAt = resultRest.timestamp
        onDidPullChanges && onDidPullChanges(resultRest)
      }

      log && (log.newLastPulledAt = chunkNewLastPulledAt)
      invariant(
        typeof chunkNewLastPulledAt === 'number' && chunkNewLastPulledAt > 0,
        `pullChanges() returned invalid timestamp ${chunkNewLastPulledAt}. timestamp must be a non-zero number`,
      )

      if (!unsafeTurbo) {
        // $FlowFixMe
        const { changes: remoteChanges, ...resultRest } = pullResult
        log && (log.remoteChangeCount = remoteChangeCount)
        // $FlowFixMe
        await applyRemoteChanges(remoteChanges, {
          db: database,
          strategy: ((pullResult: any).experimentalStrategy: ?SyncPullStrategy),
          sendCreatedAsUpdated,
          log,
          conflictResolver,
          _unsafeBatchPerCollection,
        })
        onDidPullChanges && onDidPullChanges(resultRest)
      }

      log && (log.phase = 'applied remote changes')
      await setLastPulledAt(database, chunkNewLastPulledAt)

      if (shouldSaveSchemaVersion) {
        await setLastPulledSchemaVersion(database, schemaVersion)
      }
    }, 'sync-synchronize-apply')
    result = await pullChunks.next()
  }

  if (newLastPulledAt === null) {
      invariant(
        typeof newLastPulledAt === 'number',
        `A pullChanges() function must yield at least one result`,
      )
  }

  // push phase
  if (pushChanges) {
    log && (log.phase = 'ready to fetch local changes')

    const localChanges = await fetchLocalChanges(database)
    log && (log.localChangeCount = changeSetCount(localChanges.changes))
    log && (log.phase = 'fetched local changes')

    ensureSameDatabase(database, resetCount)
    if (!isChangeSetEmpty(localChanges.changes)) {
      log && (log.phase = 'ready to push')
      const pushResult =
        (await pushChanges({ changes: localChanges.changes, lastPulledAt: newLastPulledAt })) || {}
      log && (log.phase = 'pushed')
      log && (log.rejectedIds = pushResult.experimentalRejectedIds)

      ensureSameDatabase(database, resetCount)
      await markLocalChangesAsSynced(database, localChanges, pushResult.experimentalRejectedIds)
      log && (log.phase = 'marked local changes as synced')
    }
  } else {
    log && (log.phase = 'pushChanges not defined')
  }

  log && (log.finishedAt = new Date())
  log && (log.phase = 'done')
}
