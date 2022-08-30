type Callback = () => void

export function onLowMemory(callback: Callback): void

export function _triggerOnLowMemory(): void
