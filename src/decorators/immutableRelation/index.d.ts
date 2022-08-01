declare module '@nozbe/watermelondb/decorators/immutableRelation' {
  import { ColumnName, TableName } from '@nozbe/watermelondb'

  const immutableRelation: (
    relationTable: TableName<any>,
    relationIdColumn: ColumnName,
  ) => PropertyDecorator

  export default immutableRelation
}
