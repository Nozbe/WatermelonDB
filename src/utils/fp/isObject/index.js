// @flow

export default function isObject<T>(maybeObject: T): boolean {
  return maybeObject !== null && typeof maybeObject === 'object' && !Array.isArray(maybeObject)
}
