// @flow
/* eslint-disable no-console */

type ActionQueueItem<T> = $Exact<{
  work: () => Promise<T>,
  resolve: (value: T) => void,
  reject: (reason: any) => void,
  description: ?string,
}>

export default class ActionQueue {
  _queue: ActionQueueItem<any>[] = []

  get isRunning(): boolean {
    return this._queue.length > 0
  }

  enqueue<T>(work: () => Promise<T>, description?: string): Promise<T> {
    return new Promise((resolve, reject) => {
      if (process.env.NODE_ENV !== 'production') {
        const queue = this._queue
        if (queue.length) {
          const current = queue[0]
          console.warn(
            `The action you're trying to perform (${description ||
              'unnamed'}) can't be performed yet, beacuse there are ${
              queue.length
            } actions in the queue. Current action: ${current.description ||
              'unnamed'}. Ignore this message if everything is working fine. But if your actions are not running, it's because the current action is stuck. Remember that if you're calling an action from an action, you must use subAction(). See docs for more details.`,
          )
          console.log(`Enqueued action:`, work)
          console.log(`Running action:`, current.work)
        }
      }

      this._queue.push({ work, resolve, reject, description })

      if (this._queue.length === 1) {
        this._executeNext()
      }
    })
  }

  async _executeNext(): Promise<void> {
    const { work, resolve, reject } = this._queue[0]

    try {
      resolve(await work())
    } catch (error) {
      reject(error)
    }

    this._queue.shift()

    if (this._queue.length) {
      setTimeout(() => this._executeNext(), 0)
    }
  }
}
