declare module '@nozbe/watermelondb/decorators/relation' {
  import { ColumnName, TableName } from "@nozbe/watermelondb";
  import { Decorator, RawDecorator } from "@nozbe/watermelondb/utils/common/makeDecorator";
  import { Options } from "@nozbe/watermelondb/Relation";

  const relation: Decorator<[
    TableName<any>,
    ColumnName,
    Options | void
  ], (
    relationTable: TableName<any>,
    relationIdColumn: ColumnName,
    options: Options | void,
  ) => RawDecorator>;

  export default relation;
}