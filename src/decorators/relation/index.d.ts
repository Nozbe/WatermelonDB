import { ColumnName, TableName } from '../../Schema'
import { Options } from '../../Relation'

declare function relation(
  relationTable: TableName<any>,
  relationIdColumn: ColumnName,
  options?: Options,
): PropertyDecorator

export default relation
