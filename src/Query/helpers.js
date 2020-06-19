// @flow

import zip from '../utils/fp/zip'

import type { Associations, AssociationInfo } from '../Model'
import type { TableName } from '../Schema'

export const getAssociations: (
  TableName<any>[],
  Associations,
) => [TableName<any>, AssociationInfo][] = (tables, associations) =>
  zip(tables, tables.map(table => associations[table]))
