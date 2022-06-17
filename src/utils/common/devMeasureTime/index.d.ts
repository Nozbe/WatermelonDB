export const getPreciseTime: () => number;

export function devMeasureTime<T>(executeBlock: () => T): [T, number];

export function devMeasureTimeAsync<T>(executeBlock: () => Promise<T>): Promise<[T, number]>;
