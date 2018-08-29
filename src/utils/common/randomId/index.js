// @flow

import { join, times } from 'rambdax'

// Only numers and letters for human friendliness
const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz'
const idLength = 16

const randomCharacter = () => {
  const random = Math.floor(Math.random() * alphabet.length)
  return alphabet[random]
}

export default function randomId(): string {
  return join('', times(randomCharacter, idLength))
}
