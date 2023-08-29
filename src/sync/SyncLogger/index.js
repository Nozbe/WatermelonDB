// @flow

import { mapObj } from '../../utils/fp'
import type { SyncLog } from '../index'
import censorRaw from '../../diagnostics/censorRaw'

const censorLog = (log: SyncLog): SyncLog => ({
  ...log,
  // $FlowFixMe
  ...(log.resolvedConflicts
    ? {
        // $FlowFixMe
        resolvedConflicts: log.resolvedConflicts.map((conflict) => mapObj(censorRaw)(conflict)),
      }
    : {}),
})
const censorLogs = (logs: Array<SyncLog>) => logs.map(censorLog)

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
