// @flow

// don't import whole `utils` to keep worker size small
import logError from 'utils/common/logError'
import invariant from 'utils/common/invariant'

import LokiExecutor from './executor'
import queue, { type QueueObject } from './helpers/queue'
import { actions, responseActions, type WorkerExecutorAction } from '../common'

const ExecutorProto = LokiExecutor.prototype
const executorMethods = {
  [actions.SETUP]: ExecutorProto.setUp,
  [actions.FIND]: ExecutorProto.find,
  [actions.QUERY]: ExecutorProto.query,
  [actions.COUNT]: ExecutorProto.count,
  [actions.CREATE]: ExecutorProto.create,
  [actions.BATCH]: ExecutorProto.batch,
  [actions.UPDATE]: ExecutorProto.update,
  [actions.DESTROY_PERMANENTLY]: ExecutorProto.destroyPermanently,
  [actions.UNSAFE_RESET_DATABASE]: ExecutorProto.unsafeResetDatabase,
  [actions.GET_LOCAL]: ExecutorProto.getLocal,
  [actions.SET_LOCAL]: ExecutorProto.setLocal,
  [actions.REMOVE_LOCAL]: ExecutorProto.removeLocal,
  [actions.MARK_AS_DELETED]: ExecutorProto.markAsDeleted,
  [actions.GET_DELETED_RECORDS]: ExecutorProto.getDeletedRecords,
  [actions.DESTROY_DELETED_RECORDS]: ExecutorProto.destroyDeletedRecords,
  [actions.UNSAFE_CLEAR_CACHED_RECORDS]: ExecutorProto.unsafeClearCachedRecords,
}

const { RESPONSE_SUCCESS, RESPONSE_ERROR } = responseActions

export default class LokiWorker {
  workerContext: DedicatedWorkerGlobalScope

  executor: ?LokiExecutor

  asyncQueue: QueueObject

  constructor(workerContext: DedicatedWorkerGlobalScope): void {
    this.workerContext = workerContext
    this._setUpQueue()
    // listen for messages

    // https://github.com/facebook/flow/blob/master/lib/bom.js#L504
    // looks like incorrect type, should be: onmessage: (ev: MessageEvent) => any;
    // PR: https://github.com/facebook/flow/pull/6100
    const context = (this.workerContext: any)
    context.onmessage = (e: MessageEvent) => {
      this.asyncQueue.push(e.data, (action: WorkerExecutorAction) => {
        const { type, payload } = action

        this.workerContext.postMessage({
          type,
          payload,
        })
      })
    }
  }

  _setUpQueue(): void {
    this.asyncQueue = queue(async (action: WorkerExecutorAction, callback) => {
      try {
        const { type, payload } = action
        invariant(type in actions, `Unknown worker action ${type}`)

        // app just launched, set up executor with options sent
        if (type === actions.SETUP) {
          invariant(!this.executor, `Loki executor already set up - cannot set up again`)
          const [options] = payload
          this.executor = new LokiExecutor(options)
        }

        // run action
        invariant(this.executor, `Cannot run actions because executor is not set up`)

        const runExecutorAction = executorMethods[type].bind(this.executor)
        const data = await runExecutorAction(...payload)

        callback({
          type: RESPONSE_SUCCESS,
          payload: data,
        })
      } catch (error) {
        // Main process only receives error message — this logError is to retain call stack
        logError(error)
        callback({
          type: RESPONSE_ERROR,
          payload: error,
        })
      }
    })
  }
}
