export default function identicalArrays<T, V extends T[]>(left: V, right: V): boolean {
  if (left.length !== right.length) {
    return false
  }

  for (let i = 0, len = left.length; i < len; i += 1) {
    if (left[i] !== right[i]) {
      return false
    }
  }

  return true
}
