// @flow

import { invariant, logger } from '../utils/common'

export interface ActionInterface {
  subAction<T>(work: () => Promise<T>): Promise<T>;
}

type WorkQueueItem<T> = $Exact<{
  work: (ActionInterface) => Promise<T>,
  isWriter: boolean,
  resolve: (value: T) => void,
  reject: (reason: any) => void,
  description: ?string,
}>

export default class WorkQueue {
  _queue: WorkQueueItem<any>[] = []

  _subActionIncoming: boolean = false

  get isWriterRunning(): boolean {
    const [item] = this._queue
    return Boolean(item && item.isWriter)
  }

  enqueue<T>(
    work: (ActionInterface) => Promise<T>,
    description: ?string,
    isWriter: boolean,
  ): Promise<T> {
    // If a subAction was scheduled using subAction(), database.write/read() calls skip the line
    if (this._subActionIncoming) {
      this._subActionIncoming = false
      return work(this)
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
          }. If everything is working fine, you can safely ignore this message (queueing is working as expected). But if your readers/writers are not running, it's because the current ${currentKind} is stuck. Remember that if you're calling a reader/writer from another reader/writer, you must use subAction(). See docs for more details.`,
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
      return work()
    } catch (error) {
      this._subActionIncoming = false
      return Promise.reject(error)
    }
  }

  async _executeNext(): Promise<void> {
    const workItem = this._queue[0]
    const { work, resolve, reject } = workItem

    try {
      const workPromise = work(this)

      if (process.env.NODE_ENV !== 'production') {
        invariant(
          workPromise instanceof Promise,
          `The function passed to database.${
            workItem.isWriter ? 'write' : 'read'
          }() or a method marked as @${
            workItem.isWriter ? 'writer' : 'reader'
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
