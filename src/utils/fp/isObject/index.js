// @flow

const isObject: <T>(T) => boolean = maybeObject =>
  maybeObject !== null && typeof maybeObject === 'object' && !Array.isArray(maybeObject)

export default isObject
