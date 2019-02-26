declare module '@nozbe/watermelondb/decorators/children' {
  import { Decorator, RawDecorator } from "@nozbe/watermelondb/utils/common/makeDecorator";
  import { TableName } from "@nozbe/watermelondb";

  const children: Decorator<[TableName<any>], (childTable: TableName<any>) => RawDecorator>;
  export default children;
}