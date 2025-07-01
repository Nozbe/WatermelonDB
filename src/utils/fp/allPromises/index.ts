const allPromises = <T, U>(action: (arg1: T) => Promise<U>, promises: T[]): Promise<U[]> =>
  Promise.all(promises.map(action))

export default allPromises
