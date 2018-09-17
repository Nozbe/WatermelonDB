declare module '@nozbe/watermelondb/Database' {
  import { AppSchema, CollectionMap, DatabaseAdapter, Model, TableName } from "@nozbe/watermelondb";
  import { CollectionChange } from "@nozbe/watermelondb/Collection";
  import { Observable } from "rxjs";

  export default class Database {
    adapter: DatabaseAdapter;

    schema: AppSchema;

    collections: CollectionMap;

    constructor(options: {
      adapter: DatabaseAdapter,
      modelClasses: Array<Class<Model>>,
    });

    batch(...records: Model[]): Promise<void>;

    withChangesForTables(tables: TableName<any>[]): Observable<CollectionChange<any> | null>;

    unsafeResetDatabase(): Promise<void>;


  }
}