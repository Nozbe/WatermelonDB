// Deep-freezes an object, but DOES NOT handle cycles
export default function deepFreeze<T = Object>(object: T): T
