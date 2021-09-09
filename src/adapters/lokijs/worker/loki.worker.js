// @flow
/* eslint-disable no-restricted-globals */

import DatabaseBridge from './DatabaseBridge'
import type Worker from './synchronousWorker'

const getDefaultExport = (): any => {
  self.workerClass = new DatabaseBridge(self)
  return self
}

export default (getDefaultExport(): Worker)
