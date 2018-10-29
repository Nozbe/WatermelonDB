import { ColumnName, TableName } from "@nozbe/watermelondb";
import { Observable } from "rxjs";

declare module '@nozbe/watermelondb/Model' {
  export type RecordId = string

  export type SyncStatus = 'synced' | 'created' | 'updated' | 'deleted'

  export interface BelongsToAssociation { type: 'belongs_to', key: ColumnName }
  export interface HasManyAssociation { type: 'has_many', foreignKey: ColumnName }
  export type AssociationInfo = BelongsToAssociation | HasManyAssociation
  export interface Associations { [tableName: string]: AssociationInfo }

  export function associations(
    ...associationList: Array<[TableName<any>, AssociationInfo]>
  ): Associations;

  export default class Model {
    // FIXME: How to correctly point to a static this?
    public static table: TableName<Model>;

    public static associations: Associations;

    public id: RecordId;

    public syncStatus: SyncStatus;

    public update(recordUpdater?: (this: this) => void): Promise<void>;

    public prepareUpdate(recordUpdater?: (this: this) => void): this;

    public markAsDeleted(): Promise<void>;

    public destroyPermanently(): Promise<void>;

    public observe(): Observable<this>;
  }
}