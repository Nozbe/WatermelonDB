// @flow

import { type Result } from '../../utils/fp/Result'
import type { CachedQueryResult, CachedFindResult } from '../type'
import type { RecordId } from '../../Model'

export type WorkerExecutorType =
  | 'setup'
  | 'find'
  | 'query'
  | 'queryIds'
  | 'unsafeQueryRaw'
  | 'count'
  | 'batch'
  | 'getDeletedRecords'
  | 'unsafeResetDatabase'
  | 'getLocal'
  | 'setLocal'
  | 'removeLocal'
  | 'experimentalFatalError'
  | 'clearCachedRecords'

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
