// @flow

import randomId from './randomId'

let generator: () => string = randomId

// NOTE: It's is only safe for the ID to contain [a-zA-Z0-9._]. It must not contain other characters
// (especially '"\/$). Never, ever allow the ID to be set by the user w/o validating - this breaks security!
export const setGenerator = (newGenerator: () => string) => {
  if (typeof newGenerator() !== 'string') {
    throw new Error('RandomId generator function needs to return a string type.')
  }
  generator = newGenerator
}

export default (): string => generator()
