// @flow

export default function allPass<T>(predicates: Array<(T) => boolean>): T => boolean {
  const len = predicates.length
  return obj => {
    for (let i = 0; i < len; i++) {
      if (!predicates[i](obj)) {
        return false
      }
    }
    return true
  }
}
