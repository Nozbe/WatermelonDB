// @flow

import type Model from '../Model'
import invariant from '../utils/common/invariant'
import type Database from '../Database'
import type { QueryDescription } from '../QueryDescription'

import type { QueryAssociation } from './index'

export const getAssociations = (
  description: QueryDescription,
  modelClass: Class<Model>,
  db: Database,
): QueryAssociation[] =>
  description.joinTables
    .map((table) => {
      const info = modelClass.associations[table]
      invariant(
        info,
        `Query on '${modelClass.table}' joins with '${table}', but ${modelClass.name} does not have associations={} defined for '${table}'`,
      )
      return { from: modelClass.table, to: table, info }
    })
    .concat(
      description.nestedJoinTables.map(({ from, to }) => {
        const collection = db.get(from)
        invariant(
          collection,
          `Query on '${modelClass.table}' has a nested join with '${from}', but collection for '${from}' cannot be found`,
        )
        const info = collection.modelClass.associations[to]
        invariant(
          info,
          `Query on '${modelClass.table}' has a nested join from '${from}' to '${to}', but ${collection.modelClass.name} does not have associations={} defined for '${to}'`,
        )
        return {
          from,
          to,
          info,
        }
      }),
    )
