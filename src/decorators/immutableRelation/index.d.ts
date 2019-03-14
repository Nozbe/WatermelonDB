declare module '@nozbe/watermelondb/decorators/immutableRelation' {
  import { ColumnName, TableName } from '@nozbe/watermelondb'
  import { Decorator, RawDecorator } from '@nozbe/watermelondb/utils/common/makeDecorator'

  const immutableRelation: Decorator<
    [TableName<any>, ColumnName],
    (relationTable: TableName<any>, relationIdColumn: ColumnName) => RawDecorator
  >

  export default immutableRelation
}
