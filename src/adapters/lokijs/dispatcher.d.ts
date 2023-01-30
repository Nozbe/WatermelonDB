import type { ResultCallback } from '../../utils/fp/Result'
import type {
  WorkerExecutorType,
  WorkerExecutorPayload,
  WorkerResponseData,
  CloneMethod,
} from './common'

type WorkerAction = {
  id: number,
  callback: ResultCallback<WorkerResponseData>,
}
type WorkerActions = WorkerAction[]


export default class LokiDispatcher {
  _worker: Worker

  _pendingCalls: WorkerActions

  constructor(useWebWorker: boolean)

  // TODO: `any` return should be `WorkerResponsePayload`
  call<T>(
    type: WorkerExecutorType,
    payload: WorkerExecutorPayload | undefined,
    callback: ResultCallback<T>,
    // NOTE: This are used when not using web workers (otherwise, the data naturally is just copied)
    cloneMethod?: CloneMethod,
    returnCloneMethod?: CloneMethod,
  ): void
}
