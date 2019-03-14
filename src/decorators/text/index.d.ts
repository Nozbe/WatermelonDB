declare module '@nozbe/watermelondb/decorators/text' {
  import { ColumnName } from '@nozbe/watermelondb'
  import { Decorator, RawDecorator } from '@nozbe/watermelondb/utils/common/makeDecorator'

  const text: Decorator<[ColumnName], (columnName: ColumnName) => RawDecorator>

  export default text
}
