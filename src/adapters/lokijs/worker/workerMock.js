// @flow

import clone from 'lodash.clonedeep'
import LokiWorker from './lokiWorker'

// shallow-clones objects (without checking their contents), but copies arrays
function shallowCloneDeepObjects(value: any): any {
  if (Array.isArray(value)) {
    return value.map(shallowCloneDeepObjects)
  } else if (value && typeof value === 'object') {
    return Object.assign({}, value)
  }

  return value
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
    // TODO: Get rid of lodash.clonedeep - it's a very slow cloning method. I used it because
    // there some crashes when using alternatives… find those edge cases and fix them…
    // TODO: Even better, it would be great if we had zero-copy architecture (COW RawRecords?) and we didn't have to clone
    let clonedData
    if (data.fastClone) {
      clonedData = data
      clonedData.payload = shallowCloneDeepObjects(clonedData.payload)
    } else {
      clonedData = clone(data)
    }

    setImmediate(() => {
      // $FlowFixMe
      this._workerContext.onmessage({ data: clonedData })
    })
  }
}
