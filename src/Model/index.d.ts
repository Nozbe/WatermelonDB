declare module '@nozbe/watermelondb/Model' {
  import { Collection, CollectionMap, ColumnName, Database, RawRecord, TableName } from '@nozbe/watermelondb';
  import { Observable } from 'rxjs'

  export type RecordId = string

  export type SyncStatus = 'synced' | 'created' | 'updated' | 'deleted'

  export interface BelongsToAssociation {
    type: 'belongs_to'
    key: ColumnName
  }
  export interface HasManyAssociation {
    type: 'has_many'
    foreignKey: ColumnName
  }
  export type AssociationInfo = BelongsToAssociation | HasManyAssociation
  export interface Associations {
    [tableName: string]: AssociationInfo
  }

  export function associations(
    ...associationList: Array<[TableName<any>, AssociationInfo]>
  ): Associations

  export default class Model {
    // FIXME: How to correctly point to a static this?
    public static table: TableName<Model>

    public static associations: Associations

    public _raw: RawRecord

    public id: RecordId

    public syncStatus: SyncStatus

    public update(recordUpdater?: (record: this) => void): Promise<void>

    public prepareUpdate(recordUpdater?: (record: this) => void): this

    public markAsDeleted(): Promise<void>

    public destroyPermanently(): Promise<void>

    public prepareMarkAsDeleted(): this

    public prepareDestroyPermanently(): this

    public observe(): Observable<this>

    public batch(...records: Readonly<[Model]>): Promise<void>

    public subAction<T>(action: () => Promise<T>): Promise<T>

    public collection: Collection<Model>
                                 
    public collections: CollectionMap

    public database: Database

    public asModel: this                             
  }
}
