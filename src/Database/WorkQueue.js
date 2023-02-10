// @flow
/* eslint-disable no-use-before-define */

import { invariant, logger } from '../utils/common'
import type Model from '../Model'
import type Database from './index'

export interface ReaderInterface {
  callReader<T>(reader: () => Promise<T>): Promise<T>;
}

export interface WriterInterface extends ReaderInterface {
  callWriter<T>(writer: () => Promise<T>): Promise<T>;
  batch(...records: $ReadOnlyArray<Model | Model[] | null | void | false>): Promise<void>;
}

class ReaderInterfaceImpl implements ReaderInterface {
  __workItem: WorkQueueItem<any>
  __workQueue: WorkQueue

  constructor(queue: WorkQueue, item: WorkQueueItem<any>): void {
    this.__workQueue = queue
    this.__workItem = item
  }

  __validateQueue(): void {
    invariant(
      this.__workQueue._queue[0] === this.__workItem,
      'Illegal call on a reader/writer that should no longer be running',
    )
  }

  callReader<T>(reader: () => Promise<T>): Promise<T> {
    this.__validateQueue()
    return this.__workQueue.subAction(reader)
  }
}

class WriterInterfaceImpl extends ReaderInterfaceImpl implements WriterInterface {
  callWriter<T>(writer: () => Promise<T>): Promise<T> {
    this.__validateQueue()
    return this.__workQueue.subAction(writer)
  }

  batch(...records: any): Promise<any> {
    this.__validateQueue()
    return this.__workQueue._db.batch(records)
  }
}

const actionInterface = (queue: WorkQueue, item: WorkQueueItem<any>) =>
  item.isWriter ? new WriterInterfaceImpl(queue, item) : new ReaderInterfaceImpl(queue, item)

type WorkQueueItem<T> = $Exact<{
  work: (ReaderInterface | WriterInterface) => Promise<T>,
  isWriter: boolean,
  resolve: (value: T) => void,
  reject: (reason: any) => void,
  description: ?string,
}>

export default class WorkQueue {
  _db: Database

  _queue: WorkQueueItem<any>[] = []

  _subActionIncoming: boolean = false

  constructor(db: Database): void {
    this._db = db
  }

  get isWriterRunning(): boolean {
    const [item] = this._queue
    return Boolean(item && item.isWriter)
  }

  enqueue<T>(
    work: ($FlowFixMe<ReaderInterface | WriterInterface>) => Promise<T>,
    description: ?string,
    isWriter: boolean,
  ): Promise<T> {
    // If a subAction was scheduled using subAction(), database.write/read() calls skip the line
    if (this._subActionIncoming) {
      this._subActionIncoming = false
      const currentWork = this._queue[0]
      if (!currentWork.isWriter) {
        invariant(!isWriter, 'Cannot call a writer block from a reader block')
      }
      return work(actionInterface(this, currentWork))
    }

    return new Promise((resolve, reject) => {
      if (process.env.NODE_ENV !== 'production' && this._queue.length) {
        // TODO: This warning confuses people - maybe delay its showing by some time (say, 1s) to avoid showing it unnecessarily?
        const queue = this._queue
        const current = queue[0]
        const enqueuedKind = isWriter ? 'writer' : 'reader'
        const currentKind = current.isWriter ? 'writer' : 'reader'
        logger.warn(
          `The ${enqueuedKind} you're trying to run (${
            description || 'unnamed'
          }) can't be performed yet, because there are ${
            queue.length
          } other readers/writers in the queue. Current ${currentKind}: ${
            current.description || 'unnamed'
          }. If everything is working fine, you can safely ignore this message (queueing is working as expected). But if your readers/writers are not running, it's because the current ${currentKind} is stuck. Remember that if you're calling a reader/writer from another reader/writer, you must use callReader()/callWriter(). See docs for more details.`,
        )
        logger.log(`Enqueued ${enqueuedKind}:`, work)
        logger.log(`Running ${currentKind}:`, current.work)
      }

      this._queue.push({ work, isWriter, resolve, reject, description })

      if (this._queue.length === 1) {
        this._executeNext()
      }
    })
  }

  subAction<T>(work: () => Promise<T>): Promise<T> {
    try {
      this._subActionIncoming = true
      const promise = work()
      invariant(
        !this._subActionIncoming,
        'callReader/callWriter call must call a reader/writer synchronously',
      )
      return promise
    } catch (error) {
      this._subActionIncoming = false
      return Promise.reject(error)
    }
  }

  async _executeNext(): Promise<void> {
    const workItem = this._queue[0]
    const { work, resolve, reject, isWriter } = workItem

    try {
      const workPromise = work(actionInterface(this, workItem))

      if (process.env.NODE_ENV !== 'production') {
        invariant(
          workPromise instanceof Promise,
          `The function passed to database.${
            isWriter ? 'write' : 'read'
          }() or a method marked as @${
            isWriter ? 'writer' : 'reader'
          } must be asynchronous (marked as 'async' or always returning a promise) (in: ${
            workItem.description || 'unnamed'
          })`,
        )
      }

      resolve(await workPromise)
    } catch (error) {
      reject(error)
    }

    this._queue.shift()

    if (this._queue.length) {
      setTimeout(() => this._executeNext(), 0)
    }
  }

  _abortPendingWork(): void {
    invariant(this._queue.length >= 1, '_abortPendingWork can only be called from a reader/writer')
    const workToAbort = this._queue.splice(1) // leave only the caller on the queue
    workToAbort.forEach(({ reject }) => {
      reject(new Error('Reader/writer has been aborted because the database was reset'))
    })
  }
}
