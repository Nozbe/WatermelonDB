// @flow

const allPromises = <T, U>(action: (T) => Promise<U>, promises: T[]): Promise<U[]> =>
  Promise.all(promises.map(action))

export default allPromises
