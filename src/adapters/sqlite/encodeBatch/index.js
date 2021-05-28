// @flow

import type { RecordId } from '../../../Model'
import type { TableName, TableSchema, AppSchema } from '../../../Schema'
import type { RawRecord } from '../../../RawRecord'
import type { BatchOperation } from '../../type'
import { validateTable } from '../../common'
import type { SQL, SQLiteArg, NativeBridgeBatchOperation } from '../type'

export function encodeInsertSql(schema: TableSchema): SQL {
  const columns = schema.columnArray
  const columnsSql = `"id", "_status", "_changed${columns
    .map((column) => `", "${column.name}`)
    .join('')}"`
  const placeholders = Array(columns.length + 3)
    .fill('?')
    .join(', ')
  return `insert into "${schema.name}" (${columnsSql}) values (${placeholders})`
}

export function encodeInsertArgs(tableSchema: TableSchema, raw: RawRecord): SQLiteArg[] {
  const columns = tableSchema.columnArray
  const len = columns.length

  const args = Array(len + 3)
  args[0] = raw.id
  args[1] = raw._status
  args[2] = raw._changed
  for (let i = 0; i < len; i++) {
    args[i + 3] = raw[(columns[i].name: any)]
  }

  return args
}

export function encodeUpdateSql(schema: TableSchema): SQL {
  const columns = schema.columnArray
  const placeholders = columns.map((column) => `, "${column.name}" = ?`).join('')
  return `update "${schema.name}" set "_status" = ?, "_changed" = ?${placeholders} where "id" is ?`
}

export function encodeUpdateArgs(tableSchema: TableSchema, raw: RawRecord): SQLiteArg[] {
  const columns = tableSchema.columnArray
  const len = columns.length

  const args = Array(len + 3)
  args[0] = raw._status
  args[1] = raw._changed
  for (let i = 0; i < len; i++) {
    args[i + 2] = raw[(columns[i].name: any)]
  }
  args[len + 2] = raw.id

  return args
}

type GroupedBatchOperation =
  | ['create', TableName<any>, RawRecord[]]
  | ['update', TableName<any>, RawRecord[]]
  | ['markAsDeleted', TableName<any>, RecordId[]]
  | ['destroyPermanently', TableName<any>, RecordId[]]

const REMOVE_FROM_CACHE = -1
const IGNORE_CACHE = 0
const ADD_TO_CACHE = 1

export function groupOperations(operations: BatchOperation[]): GroupedBatchOperation[] {
  const grouppedOperations: GroupedBatchOperation[] = []
  let previousType: ?string = null
  let previousTable: ?TableName<any> = null
  let currentOperation: ?GroupedBatchOperation = null
  operations.forEach((operation) => {
    const [type, table, rawOrId] = operation
    if (type !== previousType || table !== previousTable) {
      if (currentOperation) {
        grouppedOperations.push(currentOperation)
      }
      previousType = type
      previousTable = table
      // $FlowFixMe
      currentOperation = [type, table, []]
    }

    // $FlowFixMe
    currentOperation[2].push(rawOrId)
  })
  if (currentOperation) {
    grouppedOperations.push(currentOperation)
  }
  return grouppedOperations
}

export default function encodeBatch(
  operations: BatchOperation[],
  schema: AppSchema,
): NativeBridgeBatchOperation[] {
  return groupOperations(operations).map(([type, table, recordsOrIds]) => {
    validateTable(table, schema)

    switch (type) {
      case 'create':
        return [
          ADD_TO_CACHE,
          table,
          encodeInsertSql(schema.tables[table]),
          recordsOrIds.map((raw) => encodeInsertArgs(schema.tables[table], (raw: any))),
        ]
      case 'update':
        return [
          IGNORE_CACHE,
          null,
          encodeUpdateSql(schema.tables[table]),
          recordsOrIds.map((raw) => encodeUpdateArgs(schema.tables[table], (raw: any))),
        ]
      case 'markAsDeleted':
        return [
          REMOVE_FROM_CACHE,
          table,
          `update "${table}" set "_status" = 'deleted' where "id" == ?`,
          recordsOrIds.map((id) => [(id: any)]),
        ]
      case 'destroyPermanently':
        return [
          REMOVE_FROM_CACHE,
          table,
          `delete from "${table}" where "id" == ?`,
          recordsOrIds.map((id) => [(id: any)]),
        ]
      default:
        throw new Error('unknown batch operation type')
    }
  })
}
