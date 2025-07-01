const isObject: <T>(arg1: T) => boolean = maybeObject =>
  maybeObject !== null && typeof maybeObject === 'object' && !Array.isArray(maybeObject)

export default isObject
