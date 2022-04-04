declare module '@BuildHero/watermelondb' {
  import * as Q from '@BuildHero/watermelondb/QueryDescription'
  import Database from '@BuildHero/watermelondb/Database'

  export { default as Collection } from '@BuildHero/watermelondb/Collection'
  // export { default as Database } from '@BuildHero/watermelondb/Database'
  export { default as CollectionMap } from '@BuildHero/watermelondb/Database/CollectionMap'
  export { default as Relation } from '@BuildHero/watermelondb/Relation'
  export { default as Model, associations } from '@BuildHero/watermelondb/Model'
  export { default as Query } from '@BuildHero/watermelondb/Query'
  export { tableName, columnName, appSchema, tableSchema } from '@BuildHero/watermelondb/Schema'

  export { DatabaseAdapter } from '@BuildHero/watermelondb/adapters/type'
  export { RawRecord, DirtyRaw } from '@BuildHero/watermelondb/RawRecord'
  export { RecordId } from '@BuildHero/watermelondb/Model'
  export {
    TableName,
    ColumnName,
    ColumnType,
    ColumnSchema,
    TableSchema,
    AppSchema,
  } from '@BuildHero/watermelondb/Schema'

  export { Q, Database }
}
