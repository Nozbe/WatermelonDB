// @flow

// Only numers and letters for human friendliness
const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz'
const alphabetLength = alphabet.length
const idLength = 16

// Note: for explanation of generating record IDs on the client side, see:
// https://github.com/Nozbe/WatermelonDB/issues/5#issuecomment-442046292
const randomId = (): string => {
  let id = ''
  for (let i = 0; i < idLength / 2; i += 1) {
    const random = Math.floor(Math.random() * alphabetLength * alphabetLength)
    id += alphabet[Math.floor(random / alphabetLength)]
    id += alphabet[random % alphabetLength]
  }

  return id
}

let generator = () => randomId()

export const setGenerator = (newGenerator: void => string) => {
  if (typeof newGenerator() !== 'string') {
    throw new Error('RandomId generator function needs to return a string type.')
  }
  generator = newGenerator
}

export default () => generator()
