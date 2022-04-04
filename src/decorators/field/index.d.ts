declare module '@BuildHero/watermelondb/decorators/field' {
  import { ColumnName } from '@BuildHero/watermelondb'

  const field: (columnName: ColumnName) => PropertyDecorator
  export default field
}
