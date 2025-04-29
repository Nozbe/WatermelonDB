import { NativeEventEmitter } from 'react-native'

export const EventType = {
  CDC: 'SQLITE_UPDATE_HOOK',
}

export const WatermelonDBEvents = new NativeEventEmitter(DatabaseBridge)
