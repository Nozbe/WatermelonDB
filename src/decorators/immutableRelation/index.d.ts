declare module '@BuildHero/watermelondb/decorators/immutableRelation' {
  import { ColumnName, TableName } from '@BuildHero/watermelondb'

  const immutableRelation: (
    relationTable: TableName<any>,
    relationIdColumn: ColumnName,
  ) => PropertyDecorator

  export default immutableRelation
}
