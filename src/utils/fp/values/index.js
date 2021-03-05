// @flow

export default function values<T, Key, O: { [Key]: T }>(obj: O): T[] {
  // $FlowFixMe
  return Object.values(obj)
}
