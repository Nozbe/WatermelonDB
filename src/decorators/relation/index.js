// @flow

import { ensureDecoratorUsedProperly } from '../common'

import Relation, { type Options } from '../../Relation'
import type Model from '../../Model'
import type { ColumnName, TableName } from '../../schema'

// Defines a model property that fetches a record with a specific ID
// Returns an mutable Relation object
// - when the fetched record changes
// - when the record ID changes (new record must be fetched)
// - … or emits null whenever record ID is null
//
// If the record ID *can't* change, use `immutableRelation` for efficiency
//
// Property's setter assigns a new record (you pass the record, and the ID is set)
//
// relationIdColumn - name of the column with record ID
// relationTable - name of the table containing desired recods
//
// Example: a Task has a project it belongs to (and the project can change), so it may define:
//   @relation('project', 'project_id') project: Relation<Project>

const relation = (
  relationTable: TableName<any>,
  relationIdColumn: ColumnName,
  options: ?Options,
) => (target: Object, key: string, descriptor: Object) => {
  ensureDecoratorUsedProperly(relationIdColumn, target, key, descriptor)

  return {
    get(): Relation<Model> {
      this._relationCache = this._relationCache || {}
      const cachedRelation = this._relationCache[key]
      if (cachedRelation) {
        return cachedRelation
      }

      const newRelation = new Relation(
        this,
        relationTable,
        relationIdColumn,
        options || { isImmutable: false },
      )
      this._relationCache[key] = newRelation

      return newRelation
    },
    set(): void {
      throw new Error('Don\'t set relation directly. Use relation.set() instead')
    },
  }
}

export default relation
