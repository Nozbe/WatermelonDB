// @flow

export default function keys<T: {}>(obj: T): Array<$Keys<T>> {
  // $FlowFixMe
  return Object.keys(obj)
}
