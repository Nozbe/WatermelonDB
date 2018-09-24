declare module "@nozbe/watermelondb/adapters/common" {
  import { DirtyRaw, Model, Query, RecordId, TableSchema } from "@nozbe/watermelondb";
  import { BatchOperation, CachedFindResult, CachedQueryResult } from "@nozbe/watermelondb/adapters/type";

  export type DirtyFindResult = RecordId | (DirtyRaw | void);

  export type DirtyQueryResult = Array<RecordId | DirtyRaw>;

  export function sanitizeFindResult(
    dirtyRecord: DirtyFindResult,
    tableSchema: TableSchema,
  ): CachedFindResult;

  export function sanitizeQueryResult(
    dirtyRecords: DirtyQueryResult,
    tableSchema: TableSchema,
  ): CachedQueryResult;

  export function devLogSetUp<T>(executeBlock: () => Promise<T>): Promise<void>;

  export function devLogFind(
    executeBlock: () => Promise<CachedFindResult>,
    id: string,
    table: string,
  ): Promise<CachedFindResult>;

  export function devLogQuery<T extends Model>(
    executeBlock: () => Promise<CachedQueryResult>,
    query: Query<T>,
  ): Promise<CachedQueryResult>;

  export function devLogCount<T extends Model>(
    executeBlock: () => Promise<number>,
    query: Query<T>,
  ): Promise<number>;

  export function devLogBatch<T>(
    executeBlock: () => Promise<T>,
    operations: BatchOperation[],
  ): Promise<void>;
}