declare module '@nozbe/watermelondb/RawRecord' {
  import { SyncStatus } from "@nozbe/watermelondb/Model";
  import { ColumnName, ColumnSchema, RecordId, TableSchema } from "@nozbe/watermelondb";
  
  export type DirtyRaw = Object

  export type RawRecord = {
    id: RecordId,
    _status: SyncStatus,
    _changed: string,
    last_modified: number | null,
  }

  export function sanitizedRaw(dirtyRaw: DirtyRaw, tableSchema: TableSchema): RawRecord

  export function setRawSanitized(
    rawRecord: RawRecord,
    columnName: ColumnName,
    value: any,
    columnSchema: ColumnSchema,
  ): void
}