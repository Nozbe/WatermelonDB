// @ts-nocheck

import type {ResultCallback} from '../../utils/fp/Result';
import {
  WorkerExecutorType,
  WorkerResponse,
  WorkerExecutorPayload,
  WorkerResponseData,
  CloneMethod,
} from './common'

type WorkerAction = {
  id: number;
  callback: ResultCallback<WorkerResponseData>;
};
type WorkerActions = WorkerAction[];

function createWorker(useWebWorker: boolean): Worker {
  if (useWebWorker) {
    const LokiWebWorker = (require('./worker/index.worker') as any)
    return new LokiWebWorker()
  }

  const WebWorkerMock = (require('./worker/workerMock').default as any)
  return new WebWorkerMock()
}

let _actionId = 0

function nextActionId(): number {
  _actionId += 1
  return _actionId
}

class WorkerBridge {
  _worker: Worker;

  _pendingActions: WorkerActions = [];

  constructor(useWebWorker: boolean) {
    this._worker = createWorker(useWebWorker)
    this._worker.onmessage = ({ data }) => {
      const {
        result,
        id: responseId,
      }: WorkerResponse = (data as any)
      const { callback, id } = this._pendingActions.shift()

      // sanity check
      if (id !== responseId) {
        callback({ error: (new Error('Loki worker responses are out of order') as any) })
        return
      }

      callback(result)
    }
  }

  // TODO: `any` return should be `WorkerResponsePayload`
  send<T>(
    type: WorkerExecutorType,
    payload: WorkerExecutorPayload | null | undefined = [],
    callback: ResultCallback<T>,
    // NOTE: This are used when not using web workers (otherwise, the data naturally is just copied)
    cloneMethod: CloneMethod,
    returnCloneMethod: CloneMethod,
  ): void {
    const id = nextActionId()
    this._pendingActions.push({
      callback: (callback as any),
      id,
    })
    this._worker.postMessage({ id, type, payload, cloneMethod, returnCloneMethod })
  }
}

export default WorkerBridge
