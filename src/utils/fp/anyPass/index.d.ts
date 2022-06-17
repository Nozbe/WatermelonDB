// @flow

export default function anyPass<T>(predicates: Array<(T) => boolean>): (T) => boolean