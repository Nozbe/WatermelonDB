declare module '@nozbe/watermelondb/Model' {
  import { ColumnName, TableName } from "@nozbe/watermelondb";
  import { Observable } from "rxjs";

  export type RecordId = string

  export type SyncStatus = 'synced' | 'created' | 'updated' | 'deleted'

  export type BelongsToAssociation = { type: 'belongs_to', key: ColumnName }
  export type HasManyAssociation = { type: 'has_many', foreignKey: ColumnName }
  export type AssociationInfo = BelongsToAssociation | HasManyAssociation
  export type Associations = { [tableName: string]: AssociationInfo }

  export function associations(
    ...associationList: [TableName<any>, AssociationInfo][]
  ): Associations;

  export default class Model {
    // FIXME: How to correctly point to a static this?
    static table: TableName<ThisType<Model>>;

    static associations: Associations;

    id: RecordId;

    syncStatus: SyncStatus;

    update(recordUpdater?: (this: this) => void): Promise<void>;

    prepareUpdate(recordUpdater?: (this: this) => void): this;

    markAsDeleted(): Promise<void>;

    destroyPermanently(): Promise<void>;

    observe(): Observable<this>;
  }
}