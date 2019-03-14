declare module '@nozbe/watermelondb/decorators/date' {
  import { Decorator, RawDecorator } from '@nozbe/watermelondb/utils/common/makeDecorator'
  import { ColumnName } from '@nozbe/watermelondb'

  const date: Decorator<[ColumnName], (columnName: ColumnName) => RawDecorator>
  export default date
}
