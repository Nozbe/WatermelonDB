// @flow

export default function isObj<T>(maybeObject: T): boolean {
  return maybeObject !== null && typeof maybeObject === 'object' && !Array.isArray(maybeObject)
}
