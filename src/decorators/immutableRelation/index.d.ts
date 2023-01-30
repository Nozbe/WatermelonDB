import { ColumnName, TableName } from '../../Schema'

declare function immutableRelation(relationTable: TableName<any>, relationIdColumn: ColumnName): PropertyDecorator

export default immutableRelation
