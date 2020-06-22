// @flow

import type Model from '../Model'
import type Database from '../Database'
import type { QueryDescription } from '../QueryDescription'

import type { QueryAssociation } from './index'

export const getAssociations = (
  description: QueryDescription,
  modelClass: Class<Model>,
  db: Database,
): QueryAssociation[] =>
  description.joinTables
    .map(table => ({ from: modelClass.table, to: table, info: modelClass.associations[table] }))
    .concat(
      description.nestedJoinTables.map(({ from, to }) => ({
        from,
        to,
        info: db.get(from).modelClass.associations[to],
      })),
    )
