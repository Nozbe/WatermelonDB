// @flow

const getPreciseTime: () => number = (() => {
  if (global && global.nativePerformanceNow) {
    return global.nativePerformanceNow
  } else if (typeof window !== 'undefined' && window.performance && window.performance.now) {
    return window.performance.now.bind(window.performance)
  }

  return Date.now
})()

export { getPreciseTime }

export function devMeasureTime<T>(executeBlock: () => T): [T, number] {
  const start = getPreciseTime()
  const result = executeBlock()
  const time = getPreciseTime() - start
  return [result, time]
}

export async function devMeasureTimeAsync<T>(executeBlock: () => Promise<T>): Promise<[T, number]> {
  const start = getPreciseTime()
  const result = await executeBlock()
  const time = getPreciseTime() - start
  return [result, time]
}
