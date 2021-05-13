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
import { type SyncArgs } from '../index'

export default async function synchronize({
  database,
  pullChanges,
  pushChanges,
  sendCreatedAsUpdated = false,
  migrationsEnabledAtVersion,
  log,
  conflictResolver,
  _unsafeBatchPerCollection,
  _turbo,
}: SyncArgs): Promise<void> {
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
  const { changes: remoteChanges, timestamp: newLastPulledAt } = await pullChanges({
    lastPulledAt,
    schemaVersion,
    migration,
  })
  log && (log.newLastPulledAt = newLastPulledAt)
  log && (log.remoteChangeCount = changeSetCount(remoteChanges))
  log && (log.phase = 'pulled')
  invariant(
    typeof newLastPulledAt === 'number' && newLastPulledAt > 0,
    `pullChanges() returned invalid timestamp ${newLastPulledAt}. timestamp must be a non-zero number`,
  )

  await database.action(async (action) => {
    ensureSameDatabase(database, resetCount)
    invariant(
      lastPulledAt === (await getLastPulledAt(database)),
      '[Sync] Concurrent synchronization is not allowed. More than one synchronize() call was running at the same time, and the later one was aborted before committing results to local database.',
    )
    const b4 = Date.now()
    if (_turbo) {
      // $FlowFixMe
      await database.adapter.unsafeLoadFromSync(remoteChanges)
    } else {
      await action.subAction(() =>
        applyRemoteChanges(
          database,
          remoteChanges,
          sendCreatedAsUpdated,
          log,
          conflictResolver,
          _unsafeBatchPerCollection,
        ),
      )
    }
    console.log(`[🍉] ${Date.now() - b4}`)
    log && (log.phase = 'applied remote changes')
    await setLastPulledAt(database, newLastPulledAt)

    if (shouldSaveSchemaVersion) {
      await setLastPulledSchemaVersion(database, schemaVersion)
    }
  }, 'sync-synchronize-apply')

  // push phase
  if (pushChanges) {
    log && (log.phase = 'ready to fetch local changes')

    const localChanges = await fetchLocalChanges(database)
    log && (log.localChangeCount = changeSetCount(localChanges.changes))
    log && (log.phase = 'fetched local changes')

    ensureSameDatabase(database, resetCount)
    if (!isChangeSetEmpty(localChanges.changes)) {
      log && (log.phase = 'ready to push')
      await pushChanges({ changes: localChanges.changes, lastPulledAt: newLastPulledAt })
      log && (log.phase = 'pushed')

      ensureSameDatabase(database, resetCount)
      await markLocalChangesAsSynced(database, localChanges)
      log && (log.phase = 'marked local changes as synced')
    }
  } else {
    log && (log.phase = 'pushChanges not defined')
  }

  log && (log.finishedAt = new Date())
  log && (log.phase = 'done')
}
