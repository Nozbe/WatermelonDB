import type { SyncLog } from '../index'

export default class SyncLogger {
  _limit: number

  _logs: SyncLog[]

  constructor(limit: number)

  newLog(): SyncLog

  get logs(): SyncLog[]

  get formattedLogs(): string
}
