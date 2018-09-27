// @flow

import type { CachedQueryResult } from 'adapters/type'
import type { TableName, AppSchema } from 'Schema'
import type { RawRecord } from 'RawRecord'

import type { SchemaMigrations } from '../../Schema/migrations'

export const actions = {
  SETUP: 'SETUP',
  FIND: 'FIND',
  QUERY: 'QUERY',
  COUNT: 'COUNT',
  BATCH: 'BATCH',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DESTROY_PERMANENTLY: 'DESTROY_PERMANENTLY',
  MARK_AS_DELETED: 'MARK_AS_DELETED',
  GET_DELETED_RECORDS: 'GET_DELETED_RECORDS',
  DESTROY_DELETED_RECORDS: 'DESTROY_DELETED_RECORDS',
  UNSAFE_RESET_DATABASE: 'UNSAFE_RESET_DATABASE',
  GET_LOCAL: 'GET_LOCAL',
  SET_LOCAL: 'SET_LOCAL',
  REMOVE_LOCAL: 'REMOVE_LOCAL',
  UNSAFE_CLEAR_CACHED_RECORDS: 'UNSAFE_CLEAR_CACHED_RECORDS',
}

export type LokiAdapterOptions = $Exact<{
  dbName: string,
  schema: AppSchema,
  migrationsExperimental?: SchemaMigrations,
}>

export const responseActions = {
  RESPONSE_SUCCESS: 'RESPONSE_SUCCESS',
  RESPONSE_ERROR: 'RESPONSE_ERROR',
}

export type WorkerExecutorType = $Values<typeof actions>
export type WorkerExecutorPayload = any[]

export type WorkerResponseType = $Values<typeof responseActions>

export type WorkerResponseData = CachedQueryResult | number | void | Array<?number>
export type WorkerResponseError = string
export type WorkerResponsePayload = WorkerResponseData | WorkerResponseError

export type WorkerExecutorAction = {
  type: WorkerExecutorType,
  payload: WorkerExecutorPayload,
}

export type WorkerResponseAction = {
  type: WorkerResponseType,
  payload: WorkerResponsePayload,
}

export type WorkerBatchOperation =
  | ['create', TableName<any>, RawRecord]
  | ['update', TableName<any>, RawRecord]
  | ['markAsDeleted', TableName<any>, RawRecord]
  | ['destroyPermanently', TableName<any>, RawRecord]
