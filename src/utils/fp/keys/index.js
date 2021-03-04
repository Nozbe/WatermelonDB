// @flow

export default function keys<T: {}>(obj: T): $Keys<T> {
  // $FlowFixMe
  return Object.keys(obj)
}
