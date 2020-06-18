declare module '@nozbe/watermelondb/decorators/children' {
  import { TableName } from '@nozbe/watermelondb'

  const children: (childTable: TableName<any>) => PropertyDecorator
  export default children
}
