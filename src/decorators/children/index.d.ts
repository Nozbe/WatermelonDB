import { TableName } from '../../Schema'

declare function children(childTable: TableName<any>): PropertyDecorator
export default children
