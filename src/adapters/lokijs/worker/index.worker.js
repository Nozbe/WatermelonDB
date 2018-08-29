// @flow
/* eslint-disable no-restricted-globals */

import LokiWorker from './lokiWorker'

if (process.env.NODE_ENV !== 'test') {
  self.workerClass = new LokiWorker(self)
}

export default self
