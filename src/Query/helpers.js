// @flow

import type Model from '../Model'
import type { TableName } from '../Schema'
import type Database from '../Database'

import type { QueryAssociation } from './index'

export const getAssociations = (
  tables: TableName<any>[],
  modelClass: Class<Model>,
  db: Database,
): QueryAssociation[] =>
  tables.map(tableSpec =>
    typeof tableSpec === 'string'
      ? { from: modelClass.table, to: tableSpec, info: modelClass.associations[tableSpec] }
      : {
          // $FlowFixMe
          from: tableSpec[0],
          // $FlowFixMe
          to: tableSpec[1],
          // $FlowFixMe
          info: db.get(tableSpec[0]).modelClass.associations[tableSpec[1]],
        },
  )
