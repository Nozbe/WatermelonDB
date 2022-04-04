declare module '@BuildHero/watermelondb/Database' {
  import { AppSchema, CollectionMap, DatabaseAdapter, Model, TableName } from '@BuildHero/watermelondb'
  import { CollectionChangeSet } from '@BuildHero/watermelondb/Collection'
  import { Class } from '@BuildHero/watermelondb/utils/common'
  import { Observable } from 'rxjs'

  export interface ActionInterface {
    subAction<T>(action: () => Promise<T>): Promise<T>
  }

  export default class Database {
    public adapter: DatabaseAdapter

    public schema: AppSchema

    public collections: CollectionMap

    public constructor(
      options: {
        adapter: DatabaseAdapter;
        modelClasses: Class<Model>[];
        actionsEnabled: boolean;
      })

    public batch(...records: Model[] | null[] | void[] | false[] | Promise<void>[]): Promise<void>

    // TODO: action<T>(work: ActionInterface => Promise<T>, description?: string): Promise<T>
    public action<T>(work: any, description?: string): Promise<T>

    public withChangesForTables(
      tables: Array<TableName<any>>,
    ): Observable<CollectionChangeSet<any> | null>

    public unsafeResetDatabase(): Promise<void>
  }
}
