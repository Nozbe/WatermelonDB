declare module '@nozbe/watermelondb/decorators/children' {
  import { TableName } from '@nozbe/watermelondb'
  import { Decorator, RawDecorator } from '@nozbe/watermelondb/utils/common/makeDecorator'

  const children: Decorator<[TableName<any>], (childTable: TableName<any>) => RawDecorator>
  export default children
}
