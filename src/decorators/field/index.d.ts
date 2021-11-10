declare module '@nozbe/watermelondb/decorators/field' {
  import { ColumnName } from '@nozbe/watermelondb'

  const field: (columnName: ColumnName) => PropertyDecorator
  export default field
}
