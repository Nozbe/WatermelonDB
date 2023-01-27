import { TableName } from '../../Schema'

type children = (childTable: TableName<any>) => PropertyDecorator
export default children
