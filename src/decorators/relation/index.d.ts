import { Options } from '../../Relation'
import { ColumnName, TableName } from '../../Schema'

declare function relation(
  relationTable: TableName<any>,
  relationIdColumn: ColumnName,
  options?: Options,
): PropertyDecorator

export default relation
