// @flow

import {
  responseActions,
  type WorkerExecutorType,
  type WorkerResponse,
  type WorkerExecutorPayload,
  type WorkerResponsePayload,
} from './common'

type PromiseResponse = WorkerResponsePayload => void
type WorkerAction = {
  id: number,
  resolve: PromiseResponse,
  reject: PromiseResponse,
}
type WorkerActions = WorkerAction[]

const { RESPONSE_SUCCESS, RESPONSE_ERROR } = responseActions

function createWorker(useWebWorker: boolean): Worker {
  if (useWebWorker) {
    const LokiWebWorker = (require('./worker/index.worker'): any)
    return new LokiWebWorker()
  }

  const WebWorkerMock = (require('./worker/workerMock').default: any)
  return new WebWorkerMock()
}

let _actionId = 0

function nextActionId(): number {
  _actionId += 1
  return _actionId
}

class WorkerBridge {
  _worker: Worker

  _pendingActions: WorkerActions = []

  constructor(useWebWorker: boolean): void {
    this._worker = createWorker(useWebWorker)
    this._worker.onmessage = ({ data }) => {
      const { type, payload, id: responseId }: WorkerResponse = (data: any)
      const { resolve, reject, id } = this._pendingActions.shift()

      // sanity check
      if (id !== responseId) {
        reject((new Error('Loki worker responses are out of order'): any))
      }

      if (type === RESPONSE_ERROR) {
        reject(payload)
      } else if (type === RESPONSE_SUCCESS) {
        resolve(payload)
      }
    }
  }

  // TODO: `any` return should be `WorkerResponsePayload`
  send(
    type: WorkerExecutorType,
    payload: WorkerExecutorPayload = [],
    cloneMethod: 'shallowCloneDeepObjects' | 'immutable' | 'deep' = 'deep',
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = nextActionId()
      this._pendingActions.push({ resolve, reject, id })
      this._worker.postMessage({ id, type, payload, cloneMethod })
    })
  }
}

export default WorkerBridge
