export default function <T, U>(action: (_: T) => Promise<U>, promises: T[]): Promise<U[]>
