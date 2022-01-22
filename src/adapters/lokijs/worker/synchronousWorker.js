// @flow

import DatabaseBridge from './DatabaseBridge'
import cloneMessage from './cloneMessage'

// Simulates the web worker API
export default class SynchronousWorker {
  _bridge: DatabaseBridge

  _workerContext: DedicatedWorkerGlobalScope

  onmessage: ({ data: any }) => void = () => {}

  constructor(): void {
    // $FlowFixMe
    this._workerContext = {
      postMessage: (data) => {
        this.onmessage({ data: cloneMessage(data) })
      },
      onmessage: () => {},
    }
    // $FlowFixMe
    this._bridge = new DatabaseBridge(this._workerContext)
  }

  postMessage(data: any): void {
    this._workerContext.onmessage(({ data: cloneMessage(data) }: any))
  }
}
