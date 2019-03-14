declare module '@nozbe/watermelondb/Query/helpers' {
  import { QueryDescription } from '@nozbe/watermelondb/QueryDescription'
  import { TableName } from '@nozbe/watermelondb'
  import { AssociationInfo, Associations } from '@nozbe/watermelondb/Model'

  export const getSecondaryTables: QueryDescription

  export const getAssociations: (
    table: TableName<any>[],
    associations: Associations,
  ) => [TableName<any>, AssociationInfo][]
}
