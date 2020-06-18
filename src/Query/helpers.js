// @flow

import { uniq } from 'rambdax'

import zip from '../utils/fp/zip'

import type { QueryDescription } from '../QueryDescription'
import type { Associations, AssociationInfo } from '../Model'
import type { TableName } from '../Schema'

export const getSecondaryTables: QueryDescription => TableName<any>[] = description =>
  uniq(
    description.join
      .map(join => join.table)
      .concat(description.joinTables ? description.joinTables.tables : []),
  )

export const getAssociations: (
  TableName<any>[],
  Associations,
) => [TableName<any>, AssociationInfo][] = (tables, associations) =>
  zip(tables, tables.map(table => associations[table]))
