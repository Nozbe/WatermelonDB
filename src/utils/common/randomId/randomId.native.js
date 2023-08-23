// @flow
/* eslint-disable no-bitwise */
import { NativeModules } from 'react-native'
import nativeRandomId_v2 from './randomId_v2.native'
import nativeRandomId_fallback from './fallback'

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

let randomNumbers = []
let cur = 9999999

// TODO: This is 3-5x slower than Math.random()-based implementation
// Should be migrated to JSI, or simply implemented fully in native
// (bridging is the bottleneck)
function nativeRandomId_v1(): string {
  let id = ''
  let len = 0
  let v = 0
  while (len < 16) {
    if (cur < 256) {
      v = randomNumbers[cur] >> 2
      cur++
      if (v < 62) {
        id += alphabet[v]
        len++
      }
    } else {
      randomNumbers = NativeModules.WMDatabaseBridge.getRandomBytes(256)
      cur = 0
    }
  }

  return id
}

const nativeRandomId: () => string = (() => {
  if (NativeModules.WMDatabaseBridge?.getRandomIds) {
    return nativeRandomId_v2
  } else if (NativeModules.WMDatabaseBridge?.getRandomBytes) {
    return nativeRandomId_v1
  }
  return nativeRandomId_fallback
})()

export default nativeRandomId
