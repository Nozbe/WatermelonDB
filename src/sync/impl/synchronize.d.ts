import { type SyncArgs } from '../index'

export default function synchronize({
  database,
  pullChanges,
  onDidPullChanges,
  pushChanges,
  sendCreatedAsUpdated,
  migrationsEnabledAtVersion,
  log,
  conflictResolver,
  _unsafeBatchPerCollection,
  unsafeTurbo,
}: SyncArgs): Promise<void>
