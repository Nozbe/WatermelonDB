// @flow

export default function <T, U>(action: (T) => Promise<U>, promises: T[]): Promise<U[]>;
