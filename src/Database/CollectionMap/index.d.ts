declare module '@BuildHero/watermelondb/Database/CollectionMap' {
  import { Collection, Database, Model, TableName } from '@BuildHero/watermelondb'
  import { Class } from '@BuildHero/watermelondb/utils/common'

  export default class CollectionMap {
    public map: { [tableName: string]: Collection<any> }

    public constructor(database: Database, modelClasses: Array<Class<Model>>)

    public get<T extends Model>(tableName: TableName<T>): Collection<T>
  }
}
