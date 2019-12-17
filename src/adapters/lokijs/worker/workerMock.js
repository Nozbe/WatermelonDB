// @flow

import clone from 'lodash.clonedeep'
import LokiWorker from './lokiWorker'

// shallow-clones objects (without checking their contents), but copies arrays
export function shallowCloneDeepObjects(value: any): any {
  if (Array.isArray(value)) {
    const returned = new Array(value.length)
    for (let i = 0, len = value.length; i < len; i += 1) {
      returned[i] = shallowCloneDeepObjects(value[i])
    }
    return returned
  } else if (value && typeof value === 'object') {
    return Object.assign({}, value)
  }

  return value
}

// Simulates the web worker API
export default class LokiWorkerMock {
  _worker: LokiWorker

  _workerContext: DedicatedWorkerGlobalScope

  onmessage: ({ data: any }) => void = () => {}

  constructor(): void {
    // $FlowFixMe
    this._workerContext = {
      postMessage: data => {
        this.onmessage({ data: clone(data) })
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
    if (data.cloneMethod === 'shallowCloneDeepObjects') {
      clonedData = data
      clonedData.payload = shallowCloneDeepObjects(clonedData.payload)
    } else if (data.cloneMethod === 'immutable') {
      // we got a promise that the payload is immutable so we don't need to copy
      clonedData = data
    } else {
      clonedData = clone(data)
    }

    this._workerContext.onmessage(({ data: clonedData }: any))
  }
}
