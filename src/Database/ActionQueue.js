// @flow

type ActionQueueItem<T> = $Exact<{
  work: () => Promise<T>,
  resolve: (value: T) => void,
  reject: (reason: any) => void,
}>

export default class ActionQueue {
  _queue: ActionQueueItem<any>[] = []

  enqueue<T>(work: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this._queue.push({ work, resolve, reject })

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
