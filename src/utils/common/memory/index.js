// @flow

type Callback = () => void
const lowMemoryCallbacks: Callback[] = []

export function onLowMemory(callback: Callback): void {
  lowMemoryCallbacks.push(callback)
}

export function _triggerOnLogMemory(): void {
  lowMemoryCallbacks.forEach(callback => callback())
}
