// @flow

import { map, is } from 'rambdax'
import type { DirtyRaw } from '../../RawRecord'
import type { SyncLog } from '../index'

// beginning, end, length
const censorValue = (value: string): string =>
  `${value.slice(0, 2)}***${value.slice(-2)}(${value.length})`
const shouldCensorKey = (key: string): boolean =>
  key !== 'id' && !key.endsWith('_id') && key !== '_status' && key !== '_changed'

// $FlowFixMe
const censorRaw: DirtyRaw => DirtyRaw = map((value, key) =>
  shouldCensorKey(key) && is(String, value) ? censorValue(value) : value,
)
const censorConflicts = map(map(censorRaw))
const censorLog = (log: SyncLog): SyncLog => ({
  ...log,
  // $FlowFixMe
  ...(log.resolvedConflicts ? { resolvedConflicts: censorConflicts(log.resolvedConflicts) } : {}),
})
const censorLogs = map(censorLog)

export default class SyncLogger {
  _limit: number

  _logs: SyncLog[] = []

  constructor(limit: number = 10): void {
    this._limit = limit
  }

  newLog(): SyncLog {
    if (this._logs.length >= this._limit) {
      this._logs.shift()
    }
    const log: SyncLog = {}
    this._logs.push(log)
    return log
  }

  get logs(): SyncLog[] {
    // censor logs before viewing them
    return censorLogs(this._logs)
  }

  get formattedLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }
}
