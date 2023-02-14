// @flow
/* eslint-disable no-bitwise */
import { NativeModules } from 'react-native'

// console.log(NativeModules.WMDatabaseBridge.getRandomBytes())

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

let randomNumbers = []
let cur = 9999999

export default function nativeRandomId(): string {
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
      // getRandomValues(randomNumbers)
      randomNumbers = NativeModules.WMDatabaseBridge.getRandomBytes()
      cur = 0
    }
  }

  return id
}
