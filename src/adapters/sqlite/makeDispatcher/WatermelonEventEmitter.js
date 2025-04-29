const EventEmitter = require('events')

const EventType = {
  CDC: 'SQLITE_UPDATE_HOOK',
}

class NativeEventEmitter extends EventEmitter {
  constructor() {
    super()
  }

  addListener(event, callback) {
    super.addListener(event, callback)
    this._event = event
  }

  remove() {
    super.removeListener(this._event, this.listener)
  }
}

const WatermelonDBEvents = new NativeEventEmitter()

module.exports = { WatermelonDBEvents, EventType }
