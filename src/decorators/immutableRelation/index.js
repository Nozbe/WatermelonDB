// @flow

import type { ColumnName, TableName } from 'Schema'

import relation from 'decorators/relation'

// Defines a model property that fetches a record with a specific ID
// The property defined must be *immutable*, i.e. the relation ID must never change
// Returns an immutable Relation object
//
// If the property *can* change, use `relation`
//
// In `collection.create() or collection.prepareCreate()` block only, you can use the property's
// setter to assign a value
//
// relationIdColumn - name of the column with record ID
// relationTable - name of the table containing desired recods
//
// Example: a Comment has an author (and an author can never change), so it may define:
//   @immutableRelation('team_member', 'author_id') author: Relation<TeamMember>

const immutableRelation = (relationTable: TableName<any>, relationIdColumn: ColumnName) =>
  relation(relationTable, relationIdColumn, { isImmutable: true })

export default immutableRelation
