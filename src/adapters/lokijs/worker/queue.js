// @flow

import { Subject } from 'rxjs/Subject'
import { Observable } from 'rxjs/Observable'
import { concatMap } from 'rxjs/operators'
import identity from '../../../utils/fp/identity'
import noop from '../../../utils/fp/noop'

type VoidReturn = void | Promise<void>
type QueueWorkerCallback = any => void
type QueueWorker = (any, QueueWorkerCallback) => VoidReturn

export type QueueObject = $Exact<{
  push: (any, QueueWorkerCallback) => VoidReturn,
}>

const createQueueTask = (worker: QueueWorker, data: any, callback: Function) =>
  Observable.create(observer => {
    worker(data, result => {
      observer.next(data)
      callback(result)
      observer.complete()
    })
  })

// TODO: Refactor Queue code to follow idiomatic Rx style instead of approximating the API of `async/queue`

export default (worker: QueueWorker): QueueObject => {
  const subject = new Subject()

  subject.pipe(concatMap(identity, noop)).subscribe(noop)

  return {
    push(data, callback): void {
      subject.next(createQueueTask(worker, data, callback))
    },
  }
}
