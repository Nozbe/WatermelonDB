declare module '@nozbe/watermelondb/CollectionMap' {
  import { Collection, Database, Model, TableName } from "@nozbe/watermelondb";
  import { Class } from "@nozbe/watermelondb/utils/common/typeUtils";

  export default class CollectionMap {
    public map: { [tableName: string]: Collection<any> };

    public constructor(database: Database, modelClasses: Array<Class<Model>>);

    public get<T extends Model>(tableName: TableName<T>): Collection<T>;
  }
}