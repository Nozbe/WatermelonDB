// @flow

// don't import whole `utils` to keep worker size small
import logError from '../../../utils/common/logError'
import invariant from '../../../utils/common/invariant'

import LokiExecutor from './executor'
import {
  actions,
  type WorkerAction,
  type WorkerResponse,
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
      this.enqueue(action)
    }
  }

  enqueue(action: WorkerAction): void {
    this.queue.push(action)

    if (this.queue.length === 1) {
      this.executeNext()
    }
  }

  executeNext(): void {
    const action = this.queue[0]
    invariant(this._actionsExecuting === 0, 'worker should not have ongoing actions') // sanity check
    this.processAction(action)
  }

  onActionDone(response: WorkerResponse): void {
    invariant(this._actionsExecuting === 1, 'worker should be executing 1 action') // sanity check
    this._actionsExecuting = 0
    this.queue.shift()

    try {
      this.workerContext.postMessage(response)
    } catch (error) {
      logError(error)
    }

    if (this.queue.length) {
      this.executeNext()
    }
  }

  processAction(action: WorkerAction): void {
    try {
      this._actionsExecuting += 1

      const { type, payload, id } = action
      invariant(type in actions, `Unknown worker action ${type}`)

      if (type === actions.SETUP || type === actions.UNSAFE_RESET_DATABASE) {
        this.processActionAsync(action)
      } else {
        const response = this._runExecutorAction(type, payload)
        this.onActionDone({ id, result: { value: response } })
      }
    } catch (error) {
      this._onError(action, error)
    }
  }

  async processActionAsync(action: WorkerAction): Promise<void> {
    try {
      const { type, payload, id } = action

      if (type === actions.SETUP) {
        // app just launched, set up executor with options sent
        invariant(!this.executor, `Loki executor already set up - cannot set up again`)
        const [options] = payload
        const executor = new LokiExecutor(options)

        // set up, make this.executor available only if successful
        await executor.setUp()
        this.executor = executor

        this.onActionDone({ id, result: { value: null } })
      } else {
        const response = await this._runExecutorAction(type, payload)
        this.onActionDone({ id, result: { value: response } })
      }
    } catch (error) {
      this._onError(action, error)
    }
  }

  _runExecutorAction(type: WorkerExecutorType, payload: WorkerExecutorPayload): WorkerResponseData {
    // run action
    invariant(this.executor, `Cannot run actions because executor is not set up`)

    const runExecutorAction = executorMethods[type].bind(this.executor)
    return runExecutorAction(...payload)
  }

  _onError(action: WorkerAction, error: any): void {
    // Main process only receives error message (when using web workers) — this logError is to retain call stack
    logError(error)
    this.onActionDone({ id: action.id, result: { error } })
  }
}
