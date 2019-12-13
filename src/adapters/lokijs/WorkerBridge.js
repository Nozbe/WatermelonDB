// @flow

import type { Result } from '../../utils/fp/Result'
import {
  responseActions,
  type WorkerExecutorType,
  type WorkerResponse,
  type WorkerExecutorPayload,
  type WorkerResponsePayload,
} from './common'

type WorkerAction = {
  id: number,
  callback: (Result<WorkerResponsePayload>) => void,
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
      const { callback, id } = this._pendingActions.shift()

      // sanity check
      if (id !== responseId) {
        callback({ error: (new Error('Loki worker responses are out of order'): any) })
      }

      if (type === RESPONSE_ERROR) {
        callback({ error: (payload: any) })
      } else if (type === RESPONSE_SUCCESS) {
        callback({ value: payload })
      }
    }
  }

  // TODO: `any` return should be `WorkerResponsePayload`
  send<T>(
    type: WorkerExecutorType,
    payload: WorkerExecutorPayload = [],
    callback: (Result<T>) => void,
    cloneMethod: 'shallowCloneDeepObjects' | 'immutable' | 'deep' = 'deep',
  ): void {
    const id = nextActionId()
    this._pendingActions.push({
      callback: (callback: any),
      id,
    })
    this._worker.postMessage({ id, type, payload, cloneMethod })
  }
}

export default WorkerBridge
