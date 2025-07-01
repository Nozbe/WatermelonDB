const EventEmitter = require('events')
const EventType = require('./EventTypes')

class NativeEventEmitter extends EventEmitter {
  constructor() {
    super()
  }

  addListener(event: string, callback: (...args: any[]) => void) {
    super.addListener(event, callback)

    return {
      remove: () => {
        super.removeListener(event, callback)
      },
    }
  }
}

const WatermelonDBEvents = new NativeEventEmitter()

module.exports = { WatermelonDBEvents, EventType }
