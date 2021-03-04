// @flow

export default function values<T: {}>(obj: T): $Values<T> {
  // $FlowFixMe
  return Object.values(obj)
}
