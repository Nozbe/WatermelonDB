// @flow

// don't import whole `utils` to keep worker size small
import type { Result } from '../../../utils/fp/Result'
import logError from '../../../utils/common/logError'
import invariant from '../../../utils/common/invariant'

import LokiExecutor from './executor'
import {
  actions,
  type WorkerAction,
  type WorkerExecutorType,
  type WorkerExecutorPayload,
  type WorkerResponseData,
} from '../common'

const ExecutorProto = LokiExecutor.prototype
const executorMethods = {
  [actions.SETUP]: ExecutorProto.setUp,
  [actions.FIND]: ExecutorProto.find,
  [actions.QUERY]: ExecutorProto.query,
  [actions.COUNT]: ExecutorProto.count,
  [actions.BATCH]: ExecutorProto.batch,
  [actions.UNSAFE_RESET_DATABASE]: ExecutorProto.unsafeResetDatabase,
  [actions.GET_LOCAL]: ExecutorProto.getLocal,
  [actions.SET_LOCAL]: ExecutorProto.setLocal,
  [actions.REMOVE_LOCAL]: ExecutorProto.removeLocal,
  [actions.GET_DELETED_RECORDS]: ExecutorProto.getDeletedRecords,
  [actions.DESTROY_DELETED_RECORDS]: ExecutorProto.destroyDeletedRecords,
  [actions.EXPERIMENTAL_FATAL_ERROR]: ExecutorProto._fatalError,
  [actions.CLEAR_CACHED_RECORDS]: ExecutorProto.clearCachedRecords,
}

export default class LokiWorker {
  workerContext: DedicatedWorkerGlobalScope

  executor: ?LokiExecutor

  queue: WorkerAction[] = []

  _actionsExecuting: number = 0

  constructor(workerContext: DedicatedWorkerGlobalScope): void {
    this.workerContext = workerContext
    this.workerContext.onmessage = (e: MessageEvent) => {
      const action: WorkerAction = (e.data: any)
      // enqueue action
      this.queue.push(action)

      if (this.queue.length === 1) {
        this.executeNext()
      }
    }
  }

  executeNext(): void {
    const action = this.queue[0]
    try {
      invariant(this._actionsExecuting === 0, 'worker should not have ongoing actions') // sanity check
      this._actionsExecuting += 1

      const { type, payload } = action
      invariant(type in actions, `Unknown worker action ${type}`)

      if (type === actions.SETUP || type === actions.UNSAFE_RESET_DATABASE) {
        this.processActionAsync(action)
      } else {
        const response = this._executorAction(type)(...payload)
        this.onActionDone(action, { value: response })
      }
    } catch (error) {
      this._onError(action, error)
    }
  }

  async processActionAsync(action: WorkerAction): Promise<void> {
    try {
      const { type, payload } = action

      if (type === actions.SETUP) {
        // app just launched, set up executor with options sent
        invariant(!this.executor, `Loki executor already set up - cannot set up again`)
        const [options] = payload
        const executor = new LokiExecutor(options)

        // set up, make this.executor available only if successful
        await executor.setUp()
        this.executor = executor

        this.onActionDone(action, { value: null })
      } else {
        const response = await this._executorAction(type)(...payload)
        this.onActionDone(action, { value: response })
      }
    } catch (error) {
      this._onError(action, error)
    }
  }

  onActionDone(action: WorkerAction, result: Result<WorkerResponseData>): void {
    invariant(this._actionsExecuting === 1, 'worker should be executing 1 action') // sanity check
    this._actionsExecuting = 0
    this.queue.shift()

    try {
      const response = { id: action.id, result, cloneMethod: action.returnCloneMethod }
      this.workerContext.postMessage(response)
    } catch (error) {
      logError(error)
    }

    if (this.queue.length) {
      this.executeNext()
    }
  }

  _executorAction(type: WorkerExecutorType): (WorkerExecutorPayload) => WorkerResponseData {
    invariant(this.executor, `Cannot run actions because executor is not set up`)
    return executorMethods[type].bind(this.executor)
  }

  _onError(action: WorkerAction, error: any): void {
    // Main process only receives error message (when using web workers) — this logError is to retain call stack
    logError(error)
    this.onActionDone(action, { error })
  }
}
