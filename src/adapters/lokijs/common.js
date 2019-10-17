// @flow

import type { CachedQueryResult, CachedFindResult } from '../type'
import type { TableName } from '../../Schema'
import type { RawRecord } from '../../RawRecord'
import type { RecordId } from '../../Model'

export const actions = {
  SETUP: 'SETUP',
  FIND: 'FIND',
  QUERY: 'QUERY',
  COUNT: 'COUNT',
  BATCH: 'BATCH',
  GET_DELETED_RECORDS: 'GET_DELETED_RECORDS',
  DESTROY_DELETED_RECORDS: 'DESTROY_DELETED_RECORDS',
  UNSAFE_RESET_DATABASE: 'UNSAFE_RESET_DATABASE',
  GET_LOCAL: 'GET_LOCAL',
  SET_LOCAL: 'SET_LOCAL',
  REMOVE_LOCAL: 'REMOVE_LOCAL',
}

export const responseActions = {
  RESPONSE_SUCCESS: 'RESPONSE_SUCCESS',
  RESPONSE_ERROR: 'RESPONSE_ERROR',
}

export type WorkerExecutorType = $Values<typeof actions>
export type WorkerExecutorPayload = any[]

export type WorkerResponseType = $Values<typeof responseActions>

export type WorkerResponseData = CachedQueryResult | CachedFindResult | number | RecordId[]
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
