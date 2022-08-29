import { ColumnName } from '../../Schema'

type field = (columnName: ColumnName) => PropertyDecorator
export default field
