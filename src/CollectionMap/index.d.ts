declare module '@nozbe/watermelondb/CollectionMap' {
  import { Collection, Database, Model, TableName } from "@nozbe/watermelondb";

  export default class CollectionMap {
    map: { [tableName: string]: Collection<any> };

    constructor(database: Database, modelClasses: Class<Model>[]);

    get<T extends Model>(tableName: TableName<T>): Collection<T>;
  }
}