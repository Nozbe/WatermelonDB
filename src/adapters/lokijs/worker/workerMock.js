// @flow
import LokiWorker from './lokiWorker'

function structuralClone(obj: any): any {
  if (typeof MessageChannel !== 'undefined') {
    return new Promise(resolve => {
      // eslint-disable-next-line no-undef
      const { port1, port2 } = new MessageChannel()
      port2.onmessage = ev => resolve(ev.data)
      port1.postMessage(obj)
    })
  }
  // Node / tests
  return new Promise(resolve => {
    const lodashClone = require('lodash.clonedeep')
    const cloned = lodashClone(obj)
    setImmediate(() => {
      resolve(cloned)
    })
  })
}

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
        structuralClone(data).then(clonedData => {
          this.onmessage({ data: clonedData })
        })
        // const clonedData = clone(data)
        // setImmediate(() => {
        //   this.onmessage({ data: clonedData })
        // })
      },
      onmessage: () => {},
    }

    // $FlowFixMe
    this._worker = new LokiWorker(this._workerContext)
  }

  postMessage(data: any): void {
    // const clonedData = clone(data)
    // setImmediate(() => {
    //   // $FlowFixMe
    //   this._workerContext.onmessage({ data: clonedData })
    // })
    structuralClone(data).then(clonedData => {
      // $FlowFixMe
      this._workerContext.onmessage({ data: clonedData })
    })
  }
}
