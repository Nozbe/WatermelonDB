// @flow

import { type Result } from '../../utils/fp/Result'
import type { CachedQueryResult, CachedFindResult } from '../type'
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
  EXPERIMENTAL_BREAK: 'EXPERIMENTAL_BREAK',
  CLEAR_CACHED_RECORDS: 'CLEAR_CACHED_RECORDS',
}

export type WorkerExecutorType = $Values<typeof actions>
export type WorkerExecutorPayload = any[]

export type WorkerResponseData = CachedQueryResult | CachedFindResult | number | RecordId[]

export type CloneMethod = 'shallowCloneDeepObjects' | 'immutable' | 'deep'

export type WorkerAction = $Exact<{
  id: number,
  type: WorkerExecutorType,
  payload: WorkerExecutorPayload,
  cloneMethod: CloneMethod,
  returnCloneMethod: CloneMethod,
}>

export type WorkerResponse = $Exact<{
  id: number,
  result: Result<WorkerResponseData>,
}>
