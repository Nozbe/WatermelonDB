// @flow

// don't import whole `utils` to keep worker size small
import logError from '../../../utils/common/logError'
import invariant from '../../../utils/common/invariant'

import LokiExecutor from './executor'
import {
  actions,
  responseActions,
  type WorkerExecutorAction,
  type WorkerResponseAction,
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

const { RESPONSE_SUCCESS, RESPONSE_ERROR } = responseActions

export default class LokiWorker {
  workerContext: DedicatedWorkerGlobalScope

  executor: ?LokiExecutor

  queue: WorkerExecutorAction[] = []

  _actionsExecuting: number = 0

  constructor(workerContext: DedicatedWorkerGlobalScope): void {
    this.workerContext = workerContext
    this.workerContext.onmessage = (e: MessageEvent) => {
      const action: WorkerExecutorAction = (e.data: any)
      this.enqueue(action)
    }
  }

  sendResponse(response: WorkerResponseAction): void {
    const { type, payload } = response
    this.workerContext.postMessage({ type, payload })
  }

  enqueue(action: WorkerExecutorAction): void {
    this.queue.push(action)

    if (this.queue.length === 1) {
      this.executeNext()
    }
  }

  executeNext(): void {
    const action = this.queue[0]
    const onActionDone = (response: WorkerResponseAction): void => {
      invariant(this._actionsExecuting === 1, 'worker queue should have 1 item')
      this._actionsExecuting = 0
      this.queue.shift()

      this.sendResponse(response)

      if (this.queue.length) {
        this.executeNext()
      }
    }

    invariant(this._actionsExecuting === 0, 'worker queue should be empty') // sanity check
    this.processAction(action, onActionDone)
  }

  async processAction(
    action: WorkerExecutorAction,
    callback: WorkerResponseAction => void,
  ): Promise<void> {
    try {
      this._actionsExecuting += 1

      const { type, payload } = action
      invariant(type in actions, `Unknown worker action ${type}`)

      if (type === actions.SETUP) {
        // app just launched, set up executor with options sent
        invariant(!this.executor, `Loki executor already set up - cannot set up again`)
        const [options] = payload
        const executor = new LokiExecutor(options)

        // set up, make this.executor available only if successful
        await executor.setUp()
        this.executor = executor

        callback({ type: RESPONSE_SUCCESS, payload: null })
      } else {
        // run action
        invariant(this.executor, `Cannot run actions because executor is not set up`)

        const runExecutorAction = executorMethods[type].bind(this.executor)
        const response = await runExecutorAction(...payload)

        callback({ type: RESPONSE_SUCCESS, payload: response })
      }
    } catch (error) {
      // Main process only receives error message — this logError is to retain call stack
      logError(error)
      callback({ type: RESPONSE_ERROR, payload: error })
    }
  }
}
