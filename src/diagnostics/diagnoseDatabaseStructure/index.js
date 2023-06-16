// @flow

import type { RawRecord, Database, TableName, ColumnName } from '../..'

export type DiagnoseDatabaseStructureOptions = $Exact<{
  db: Database,

  /**
   * Optionally pass function to log messages as diagnostics are performed instead of only a bulk
   * report at the end
   */
  log?: (string) => void,

  /**
   * Return `false` to skip checking record's given parent.
   *
   * Do this when your data model's logic dictates that this parent is not valid. For example,
   * if you have a `parent_id` and `parent_type` columns, you only want to check one of the parents.
   */
  shouldSkipParent?: (
    $Exact<{
      tableName: TableName<any>,
      parentTableName: TableName<any>,
      relationKey: ColumnName,
      record: RawRecord,
    }>,
  ) => boolean,

  /**
   * When an orphan record is found, this function is consulted to determine whether this orphan relation
   * is allowed.
   *
   * Note that relations that can be orphaned should be marked as `@failsafe @relation(...)` in Model
   * or otherwise checked before fetched. Otherwise, allowing orphans here can lead to false negatives
   * in the diagnostics, and crashes in reality.
   */
  isOrphanAllowed?: (
    $Exact<{
      tableName: TableName<any>,
      parentTableName: TableName<any>,
      relationKey: ColumnName,
      record: RawRecord,
    }>,
  ) => Promise<boolean>,
}>
export type DatabaseStructureDiagnosis = $Exact<{ issueCount: number, log: string }>

export default function diagnoseDatabaseStructure(
  options: DiagnoseDatabaseStructureOptions,
): Promise<DatabaseStructureDiagnosis> {
  return require('./impl').default(options)
}
