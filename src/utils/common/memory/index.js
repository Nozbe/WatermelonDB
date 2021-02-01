// @flow

type Callback = () => void
const lowMemoryCallbacks: Callback[] = []

export function onLowMemory(callback: Callback): void {
  lowMemoryCallbacks.push(callback)
}

// TODO: Not currently hooked up to anything
export function _triggerOnLowMemory(): void {
  lowMemoryCallbacks.forEach(callback => callback())
}
