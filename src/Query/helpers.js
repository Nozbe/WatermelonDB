// @flow

import zip from '../utils/fp/zip'

import type { Associations, AssociationInfo } from '../Model'
import type { TableName } from '../Schema'

export const getAssociations: (
  TableName<any>[],
  Associations,
) => [TableName<any>, AssociationInfo][] = (tables, modelClass, db) =>
  tables.map(tableSpec =>
    typeof tableSpec === 'string'
      ? [modelClass.table, tableSpec, modelClass.associations[tableSpec]]
      : [tableSpec[0], tableSpec[1], db.get(tableSpec[0]).modelClass.associations[tableSpec[1]]],
  )
// zip(tables, tables.map(table => associations[table]))
