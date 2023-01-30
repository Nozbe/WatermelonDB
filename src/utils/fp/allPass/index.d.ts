export default function allPass<T>(predicates: Array<(_: T) => boolean>): (__: T) => boolean
