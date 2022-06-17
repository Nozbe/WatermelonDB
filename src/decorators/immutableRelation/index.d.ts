  import { ColumnName, TableName } from '../../Schema'

  type immutableRelation = (
    relationTable: TableName<any>,
    relationIdColumn: ColumnName,
  ) => PropertyDecorator

  export default immutableRelation

