declare module '@nozbe/watermelondb' {
  import * as Q from '@nozbe/watermelondb/QueryDescription'

  export { default as Collection } from '@nozbe/watermelondb/Collection'
  export { default as Database } from '@nozbe/watermelondb/Database'
  export { default as CollectionMap } from '@nozbe/watermelondb/CollectionMap'
  export { default as Relation } from '@nozbe/watermelondb/Relation'
  export { default as Model, associations } from '@nozbe/watermelondb/Model'
  export { default as Query } from '@nozbe/watermelondb/Query'
  export { tableName, columnName, appSchema, tableSchema } from '@nozbe/watermelondb/Schema'

  export { DatabaseAdapter } from '@nozbe/watermelondb/adapters/type'
  export { RawRecord, DirtyRaw } from '@nozbe/watermelondb/RawRecord'
  export { RecordId } from '@nozbe/watermelondb/Model'
  export {
    TableName,
    ColumnName,
    ColumnType,
    ColumnSchema,
    TableSchema,
    AppSchema,
  } from '@nozbe/watermelondb/Schema'

  export { Q }
}