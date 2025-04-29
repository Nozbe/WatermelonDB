import { NativeEventEmitter, NativeModules } from 'react-native'

const { DatabaseBridge } = NativeModules

export const EventType = {
  CDC: 'SQLITE_UPDATE_HOOK',
}

export const WatermelonDBEvents = new NativeEventEmitter(DatabaseBridge)
