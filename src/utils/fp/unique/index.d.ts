// @flow

// Returns a list of unique elements, compared by identity (===)
// This is a replacement for rambdax uniq() which is based on slow equals()
export default function unique<T>(list: T[]): T[]
