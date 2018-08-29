// @flow

// It's faster to cache NODE_ENV
// See: https://github.com/facebook/react/issues/812
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'

export default isDevelopment
