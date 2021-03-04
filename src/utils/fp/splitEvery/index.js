// @flow

export default function splitEvery<T>(n: number, list: T[]): T[][] {
  const splitted = []
  let position = 0
  const length = list.length
  while (position < length) {
    splitted.push(list.slice(position, position += n))
  }
  return splitted
}
