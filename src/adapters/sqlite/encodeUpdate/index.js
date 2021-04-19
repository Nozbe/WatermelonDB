// @flow

import type { TableName } from '../../../Schema'
import type { RawRecord } from '../../../RawRecord'
import type { SQL, SQLiteQuery, SQLiteArg } from '../index'

import encodeName from '../encodeName'

const encodeSetPlaceholders: RawRecord => SQL = raw =>
  Object.keys(raw)
    .map(key => `${encodeName(key)}=?`)
    .join(', ')

// $FlowFixMe
const getArgs: RawRecord => SQLiteArg[] = raw => Object.values(raw).concat(raw.id) // for `where id is ?`

export default function encodeUpdate(table: TableName<any>, raw: RawRecord): SQLiteQuery {
  const sql = `update ${encodeName(table)} set ${encodeSetPlaceholders(raw)} where "id" is ?`
  const args = getArgs(raw)

  return [sql, args]
}
