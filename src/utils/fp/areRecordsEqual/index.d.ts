// @flow

// NOTE: Only use with records! Not guaranteed to work correctly if keys have undefineds as values
export default function areRecordsEqual<T = {}>(left: T, right: T): boolean