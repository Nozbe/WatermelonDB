declare module '@BuildHero/watermelondb/decorators/text' {
  import { ColumnName } from '@BuildHero/watermelondb'

  const text: (columnName: ColumnName) => PropertyDecorator

  export default text
}
