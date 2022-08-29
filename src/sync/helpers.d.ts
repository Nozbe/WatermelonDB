import type { ColumnName } from '..'
import type { RawRecord } from '../RawRecord'

export function addToRawSet(rawSet: string, value: string): string

export function setRawColumnChange(rawRecord: RawRecord, columnName: ColumnName): void
