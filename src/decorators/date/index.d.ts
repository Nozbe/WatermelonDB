declare module '@BuildHero/watermelondb/decorators/date' {
  import { ColumnName } from '@BuildHero/watermelondb'

  const date: (columnName: ColumnName) => PropertyDecorator
  export default date
}
