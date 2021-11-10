declare module '@nozbe/watermelondb/decorators/date' {
  import { ColumnName } from '@nozbe/watermelondb'

  const date: (columnName: ColumnName) => PropertyDecorator
  export default date
}
