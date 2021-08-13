// @flow
/* eslint-disable global-require */

import DatabaseBridge from '../sqlite-node/DatabaseBridge'
import { type ConnectionTag } from '../../../utils/common'
import { type ResultCallback } from '../../../utils/fp/Result'
import type {
  DispatcherType,
  SQLiteAdapterOptions,
  SqliteDispatcher,
  SqliteDispatcherMethod,
} from '../type'

class SqliteNodeDispatcher implements SqliteDispatcher {
  _tag: ConnectionTag

  constructor(tag: ConnectionTag): void {
    this._tag = tag
  }

  call(methodName: SqliteDispatcherMethod, args: any[], callback: ResultCallback<any>): void {
    // $FlowFixMe
    const method = DatabaseBridge[methodName].bind(DatabaseBridge)
    method(
      this._tag,
      ...args,
      (value) => callback({ value }),
      (code, message, error) => callback({ error }),
    )
  }
}

export const makeDispatcher = (
  _type: DispatcherType,
  tag: ConnectionTag,
  _dbName: string,
  _usesExclusiveLocking: boolean,
): SqliteDispatcher => {
  return new SqliteNodeDispatcher(tag)
}

export function getDispatcherType(_options: SQLiteAdapterOptions): DispatcherType {
  return 'asynchronous'
}
