// @flow

import { invariant, logger } from '../utils/common'

export interface ActionInterface {
  subAction<T>(action: () => Promise<T>): Promise<T>;
}

type ActionQueueItem<T> = $Exact<{
  work: (ActionInterface) => Promise<T>,
  resolve: (value: T) => void,
  reject: (reason: any) => void,
  description: ?string,
}>

export default class ActionQueue implements ActionInterface {
  _queue: ActionQueueItem<any>[] = []

  _subActionIncoming: boolean = false

  get isRunning(): boolean {
    return this._queue.length > 0
  }

  enqueue<T>(work: (ActionInterface) => Promise<T>, description?: string): Promise<T> {
    // If a subAction was scheduled using subAction(), database.action() calls skip the line
    if (this._subActionIncoming) {
      this._subActionIncoming = false
      return work(this)
    }

    return new Promise((resolve, reject) => {
      if (process.env.NODE_ENV !== 'production' && this._queue.length) {
        const queue = this._queue
        const current = queue[0]
        logger.warn(
          `The action you're trying to perform (${
            description || 'unnamed'
          }) can't be performed yet, because there are ${
            queue.length
          } actions in the queue. Current action: ${
            current.description || 'unnamed'
          }. Ignore this message if everything is working fine. But if your actions are not running, it's because the current action is stuck. Remember that if you're calling an action from an action, you must use subAction(). See docs for more details.`,
        )
        logger.log(`Enqueued action:`, work)
        logger.log(`Running action:`, current.work)
      }

      this._queue.push({ work, resolve, reject, description })

      if (this._queue.length === 1) {
        this._executeNext()
      }
    })
  }

  subAction<T>(action: () => Promise<T>): Promise<T> {
    try {
      this._subActionIncoming = true
      return action()
    } catch (error) {
      this._subActionIncoming = false
      return Promise.reject(error)
    }
  }

  async _executeNext(): Promise<void> {
    const { work, resolve, reject } = this._queue[0]

    try {
      const workPromise = work(this)

      if (process.env.NODE_ENV !== 'production') {
        invariant(
          workPromise instanceof Promise,
          `The function passed to database.action() or a method marked as @action must be asynchronous — either marked as 'async' or always returning a promise (in: ${
            this._queue[0].description || 'unnamed'
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

  _abortPendingActions(): void {
    invariant(this._queue.length >= 1, 'abortPendingActions can only be called from an Action')
    const actionsToAbort = this._queue.splice(1) // leave only the current action (calling this method) on the queue

    actionsToAbort.forEach(({ reject }) => {
      reject(new Error('Action has been aborted because the database was reset'))
    })
  }
}
