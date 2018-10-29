declare module '@nozbe/watermelondb/Database' {
  import {
    AppSchema, CollectionMap, DatabaseAdapter, Model, TableName,
  } from "@nozbe/watermelondb";
  import { CollectionChange } from "@nozbe/watermelondb/Collection";
  import { Observable } from "rxjs";

  export default class Database {
    public adapter: DatabaseAdapter;

    public schema: AppSchema;

    public collections: CollectionMap;

    public constructor(options: {
      adapter: DatabaseAdapter,
      modelClasses: Array<Class<Model>>,
    });

    public batch(...records: Model[]): Promise<void>;

    public withChangesForTables(
      tables: Array<TableName<any>>,
    ): Observable<CollectionChange<any> | null>;

    public unsafeResetDatabase(): Promise<void>;
  }
}