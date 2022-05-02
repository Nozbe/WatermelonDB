import type { Database } from '../..'

import type { SyncLocalChanges } from '../index'


export default function fetchLocalChanges(db: Database): Promise<SyncLocalChanges>

export function hasUnsyncedChanges(db: Database): Promise<boolean>