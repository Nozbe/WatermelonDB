// @flow

// don't import whole `utils` to keep worker size small
import type { Result } from '../../../utils/fp/Result'
import logError from '../../../utils/common/logError'
import invariant from '../../../utils/common/invariant'

import LokiDatabaseDriver from './DatabaseDriver'
import type {
  WorkerAction,
  WorkerExecutorType,
  WorkerExecutorPayload,
  WorkerResponseData,
} from '../common'

export default class DatabaseBridge {
  workerContext: DedicatedWorkerGlobalScope

  driver: ?LokiDatabaseDriver

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

      if (type === 'setUp' || type === 'unsafeResetDatabase') {
        this.processActionAsync(action)
      } else {
        const response = this._driverAction(type)(...payload)
        this.onActionDone(action, { value: response })
      }
    } catch (error) {
      this._onError(action, error)
    }
  }

  async processActionAsync(action: WorkerAction): Promise<void> {
    try {
      const { type, payload } = action

      if (type === 'setUp') {
        // app just launched, set up driver with options sent
        invariant(!this.driver, `Loki driver already set up - cannot set up again`)
        const [options] = payload
        const driver = new LokiDatabaseDriver(options)

        // set up, make this.driver available only if successful
        await driver.setUp()
        this.driver = driver

        this.onActionDone(action, { value: null })
      } else {
        const response = await this._driverAction(type)(...payload)
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

  _driverAction(type: WorkerExecutorType): (WorkerExecutorPayload) => WorkerResponseData {
    invariant(this.driver, `Cannot run actions because driver is not set up`)
    const action = (this.driver: any)[type].bind(this.driver)
    invariant(action, `Unknown worker action ${type}`)
    return action
  }

  _onError(action: WorkerAction, error: any): void {
    // Main process only receives error message (when using web workers) — this logError is to retain call stack
    logError(error)
    this.onActionDone(action, { error })
  }
}
