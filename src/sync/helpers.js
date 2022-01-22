// @flow

import type { ColumnName } from '..'
import type { RawRecord } from '../RawRecord'

export function addToRawSet(rawSet: string, value: string): string {
  const array = rawSet ? rawSet.split(',') : []
  const set = new Set(array)
  set.add(value)
  return Array.from(set).join(',')
}

// Mutates `rawRecord` to mark `columName` as modified for sync purposes
export function setRawColumnChange(rawRecord: RawRecord, columnName: ColumnName): void {
  rawRecord._changed = addToRawSet(rawRecord._changed, columnName)
  if (rawRecord._status !== 'created') {
    rawRecord._status = 'updated'
  }
}
