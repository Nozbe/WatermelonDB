declare module '@BuildHero/watermelondb/Query/helpers' {
  import { QueryDescription } from '@BuildHero/watermelondb/QueryDescription'
  import { TableName } from '@BuildHero/watermelondb'
  import { AssociationInfo, Associations } from '@BuildHero/watermelondb/Model'

  export const getSecondaryTables: QueryDescription

  export const getAssociations: (
    table: TableName<any>[],
    associations: Associations,
  ) => [TableName<any>, AssociationInfo][]
}
