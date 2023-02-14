// @flow
/* eslint-disable no-bitwise */

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const randomNumbers = new Uint8Array(16)

const getReplacementValue = () => {
  const randomNum = new Uint8Array(1)
  window.crypto.getRandomValues(randomNum)
  const v = randomNum[0] >> 2
  if (v < 62) {
    return v
  }
  return getReplacementValue()
}

export default function randomId_slow(): string {
  let id = ''
  let v
  // NOTE: This is ~2x slower than the Math.random()-based implementation *but* it seems that
  // the .getRandomValues() call itself is the slowest bit. You could fill a 256B array, and then
  // walk over it for multiple IDs
  window.crypto.getRandomValues(randomNumbers)
  for (let i = 0; i < 16; i += 1) {
    v = randomNumbers[i] >> 2
    if (v < 62) {
      id += alphabet[v]
    } else {
      id += getReplacementValue()
    }
  }
  return id
}
