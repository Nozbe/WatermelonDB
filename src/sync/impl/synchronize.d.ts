import type { SyncArgs, OptimisticSyncPushArgs } from '../index'

export default function synchronize({
  database,
  pullChanges,
  onDidPullChanges,
  pushChanges,
  sendCreatedAsUpdated,
  migrationsEnabledAtVersion,
  log,
  conflictResolver,
  pushShouldConfirmOnlyAccepted,
  pushConflictResolver,
  _unsafeBatchPerCollection,
  unsafeTurbo,
}: SyncArgs): Promise<void>

export function optimisticSyncPush({
  database,
  pushChanges,
  log,
  pushShouldConfirmOnlyAccepted,
  pushConflictResolver,
}: OptimisticSyncPushArgs): Promise<void>
