// @flow

import { Subject } from 'rxjs/Subject'
import { Observable } from 'rxjs/Observable'
import { concatMap } from 'rxjs/operators'
import identity from '../../../utils/fp/identity'
import noop from '../../../utils/fp/noop'

type QueueWorkerCallback<Result> = Result => void
type QueueWorker<Input, Output> = (Input, QueueWorkerCallback<Output>) => Promise<void>

export type QueueObject<Input, Output> = $Exact<{
  push: (Input, QueueWorkerCallback<Output>) => void,
}>

function createQueueTask<Input, Output>(
  worker: QueueWorker<Input, Output>,
  data: Input,
  callback: QueueWorkerCallback<Output>,
): Observable<any> {
  return Observable.create(observer => {
    // console.log('Executing queue task...')
    worker(data, function lokiWorkerQueueReaction(result): void {
      // console.log('Got back queue result')
      observer.next(data)
      callback(result)
      observer.complete()
    })
  })
}

// TODO: Refactor Queue code to follow idiomatic Rx style instead of approximating the API of `async/queue`

function makeQueue<Input, Output>(worker: QueueWorker<Input, Output>): QueueObject<Input, Output> {
  const subject = new Subject()

  subject.pipe(concatMap(identity, noop)).subscribe(noop)

  return {
    push(data, callback): void {
      // console.log('Pushing onto queue...')
      subject.next(createQueueTask(worker, data, callback))
    },
  }
}

export default makeQueue
