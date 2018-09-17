declare module '@nozbe/watermelondb/Relation' {
  import { ColumnName, Model, RecordId, TableName } from "@nozbe/watermelondb";
  import { $Call } from "utility-types";
  import { Observable } from "rxjs";

  type ExtractRecordIdNonOptional<T extends Model> = (value: T) => RecordId
  type ExtractRecordIdOptional<T extends Model> = (value: T | void) => RecordId | void
  type ExtractRecordId<T extends Model> = ExtractRecordIdNonOptional<T> & ExtractRecordIdOptional<T>

  export type Options = {
    isImmutable: boolean,
  }

  export default class Relation<T extends Model> {
    constructor(
      model: Model,
      relationTableName: TableName<T>,
      columnName: ColumnName,
      options: Options,
    );

    id: $Call<ExtractRecordId<T>>;

    fetch(): Promise<T>;

    set(record: T): void;

    observe(): Observable<T>;
  }
}