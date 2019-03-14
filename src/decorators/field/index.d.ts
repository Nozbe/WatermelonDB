declare module '@nozbe/watermelondb/decorators/field' {
  import { Decorator, RawDecorator } from '@nozbe/watermelondb/utils/common/makeDecorator'
  import { ColumnName } from '@nozbe/watermelondb'

  const field: Decorator<[ColumnName], (columnName: ColumnName) => RawDecorator>
  export default field
}
