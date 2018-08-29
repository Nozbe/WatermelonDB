// @flow

import LokiWorker from './worker/index.worker'

import {
  responseActions,
  type WorkerExecutorType,
  type WorkerResponseAction,
  type WorkerExecutorPayload,
  type WorkerResponsePayload,
} from './common'

type PromiseResponse = WorkerResponsePayload => void
type WorkerAction = {
  resolve: PromiseResponse,
  reject: PromiseResponse,
}
type WorkerActions = WorkerAction[]

const { RESPONSE_SUCCESS, RESPONSE_ERROR } = responseActions

class WorkerBridge {
  _worker: Worker = this._createWorker()

  _pendingRequests: WorkerActions = []

  _createWorker(): Worker {
    const worker: Worker = new LokiWorker()

    worker.onmessage = ({ data }) => {
      const { type, payload }: WorkerResponseAction = (data: any)
      const { resolve, reject } = this._pendingRequests.shift()

      if (type === RESPONSE_ERROR) {
        reject(payload)
      } else if (type === RESPONSE_SUCCESS) {
        resolve(payload)
      }
    }

    return worker
  }

  // TODO: `any` should be `WorkerResponsePayload` here
  send(type: WorkerExecutorType, payload: WorkerExecutorPayload = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this._pendingRequests.push({ resolve, reject })

      this._worker.postMessage({
        type,
        payload,
      })
    })
  }
}

export default WorkerBridge
