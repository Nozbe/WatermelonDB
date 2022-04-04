declare module '@BuildHero/watermelondb/decorators/children' {
  import { TableName } from '@BuildHero/watermelondb'

  const children: (childTable: TableName<any>) => PropertyDecorator
  export default children
}
