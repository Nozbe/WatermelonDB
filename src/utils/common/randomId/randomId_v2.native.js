// @flow
import { NativeModules } from 'react-native'

let randomIds = []
let cur = 9999

// NOTE: This is 2x faster thn Math.random on iOS (6x faster than _v1)
// Should be ported to Java too… or better yet, implemented in JSI
export default function nativeRandomId_v2(): string {
  if (cur >= 64) {
    randomIds = NativeModules.WMDatabaseBridge.getRandomIds().split(',')
    cur = 0
  }

  return randomIds[cur++]
}
