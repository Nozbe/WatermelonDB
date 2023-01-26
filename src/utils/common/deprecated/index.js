// @flow

import logger from '../logger'

const deprecationsReported: { [string]: boolean } = {}

export default function deprecated(name: string, deprecationInfo: string): void {
  if (!deprecationsReported[name]) {
    deprecationsReported[name] = true
    logger.warn(
      `DEPRECATION: ${name} is deprecated. ${deprecationInfo} See changelog & docs for more info.`,
    )
  }
}
