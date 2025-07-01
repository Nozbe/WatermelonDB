import { v7 as uuidV7 } from 'uuid'

let generator: (arg1?: undefined) => string = () => uuidV7()

// NOTE: It's is only safe for the ID to contain [a-zA-Z0-9._]. It must not contain other characters
// (especially '"\/$). Never, ever allow the ID to be set by the user w/o validating - this breaks security!
export const setGenerator = (newGenerator: (arg1: undefined) => string) => {
  if (typeof newGenerator(undefined) !== 'string') {
    throw new Error('RandomId generator function needs to return a string type.')
  }
  generator = newGenerator
}

export default () => generator()
