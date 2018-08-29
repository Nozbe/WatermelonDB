// @flow

// bottleneck function without dependencies to optimize performance
const identicalArrays = <T, V: T[]>(arrayA: V, arrayB: V): boolean =>
  arrayA.length === arrayB.length && arrayA.every((el, index) => el === arrayB[index])

export default identicalArrays
