// @flow

import { join, times } from 'rambdax'

// Only numers and letters for human friendliness
const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz'
const idLength = 16

const randomCharacter = () => {
  const random = Math.floor(Math.random() * alphabet.length)
  return alphabet[random]
}

// Note: for explanation of generating record IDs on the client side, see:
// https://github.com/Nozbe/WatermelonDB/issues/5#issuecomment-442046292
const randomId = (): string => {
  return join('', times(randomCharacter, idLength))
}

let generator = () => randomId()

export const setGenerator = (newGenerator: void => string) => {
  if (typeof newGenerator() !== 'string') {
    throw new Error('RandomId generator function needs to return a string type.')
  }
  generator = newGenerator
}

export default () => generator()
