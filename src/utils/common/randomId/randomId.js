// @flow
/* eslint-disable no-bitwise */

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

const randomNumbers = new Uint8Array(256)
let cur = 9999999

function cryptoRandomId(): string {
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
      globalThis.crypto.getRandomValues(randomNumbers)
      cur = 0
    }
  }

  return id
}

const isCryptoAvailable: boolean = globalThis.crypto && globalThis.crypto.getRandomValues
const randomId: () => string = isCryptoAvailable ? cryptoRandomId : require('./fallback').default

export default randomId
