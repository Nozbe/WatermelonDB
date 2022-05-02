// @flow

export default function allPass<T>(predicates: Array<(T) => boolean>): (T) => boolean