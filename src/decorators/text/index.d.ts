declare module '@nozbe/watermelondb/decorators/text' {
  import { ColumnName } from '@nozbe/watermelondb'

  const text: (columnName: ColumnName) => PropertyDecorator

  export default text
}
