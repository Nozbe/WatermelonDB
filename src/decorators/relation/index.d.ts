declare module '@nozbe/watermelondb/decorators/relation' {
  import { ColumnName, TableName } from '@nozbe/watermelondb'
  import { Options } from '@nozbe/watermelondb/Relation'

  const relation: (
    relationTable: TableName<any>,
    relationIdColumn: ColumnName,
    options?: Options,
  ) => PropertyDecorator


  export default relation
}
