declare module '@BuildHero/watermelondb/decorators/relation' {
  import { ColumnName, TableName } from '@BuildHero/watermelondb'
  import { Options } from '@BuildHero/watermelondb/Relation'

  const relation: (
    relationTable: TableName<any>,
    relationIdColumn: ColumnName,
    options?: Options,
  ) => PropertyDecorator

  export default relation
}
