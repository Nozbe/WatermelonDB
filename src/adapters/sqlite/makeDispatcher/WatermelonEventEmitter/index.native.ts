import { NativeEventEmitter, NativeModules } from 'react-native'
import EventType from './EventTypes'

const { DatabaseBridge } = NativeModules

export const WatermelonDBEvents = new NativeEventEmitter(DatabaseBridge)

export { EventType }
