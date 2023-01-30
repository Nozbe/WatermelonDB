export default function anyPass<T>(predicates: Array<(_: T) => boolean>): (__: T) => boolean
