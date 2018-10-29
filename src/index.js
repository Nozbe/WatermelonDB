// @flow

<<<<<<< HEAD
import * as Q from 'QueryDescription/index'

export { default as Collection } from 'Collection/index'
export { default as Database } from 'Database/index'
export { default as CollectionMap } from 'CollectionMap/index'
export { default as Relation } from 'Relation/index'
export { default as Model, associations } from 'Model/index'
export { default as Query } from 'Query/index'
export { tableName, columnName, appSchema, tableSchema } from 'Schema'

export type { DatabaseAdapter } from 'adapters/type'
export type { RawRecord, DirtyRaw } from 'Relation/index'
export type { RecordId } from 'Model/index'
=======
import * as Q from './QueryDescription'

export { default as Collection } from './Collection'
export { default as Database } from './Database'
export { default as CollectionMap } from './Database/CollectionMap'
export { default as Relation } from './Relation'
export { default as Model, associations } from './Model'
export { default as Query } from './Query'
export { tableName, columnName, appSchema, tableSchema } from './Schema'

export type { DatabaseAdapter } from './adapters/type'
export type { RawRecord, DirtyRaw } from './RawRecord'
export type { RecordId } from './Model'
>>>>>>> upstream/master
export type {
  TableName,
  ColumnName,
  ColumnType,
  ColumnSchema,
  TableSchema,
  AppSchema,
} from './Schema'
export type { SchemaMigrations } from './Schema/migrations'

export { Q }
