// @flow

import clone from 'lodash.clonedeep'
import LokiWorker from '../lokiWorker'

// Simulates the web worker API for test env (while really just passing messages asynchronously
// on main thread)
export default class LokiWorkerMock {
  _worker: LokiWorker

  _workerContext: DedicatedWorkerGlobalScope

  onmessage: ({ data: any }) => void = () => {}

  constructor(): void {
    // $FlowFixMe
    this._workerContext = {
      postMessage: data => {
        const clonedData = clone(data)
        setImmediate(() => {
          this.onmessage({ data: clonedData })
        })
      },
      onmessage: () => {},
    }

    // $FlowFixMe
    this._worker = new LokiWorker(this._workerContext)
  }

  postMessage(data: any): void {
    const clonedData = clone(data)
    setImmediate(() => {
      // $FlowFixMe
      this._workerContext.onmessage({ data: clonedData })
    })
  }
}
