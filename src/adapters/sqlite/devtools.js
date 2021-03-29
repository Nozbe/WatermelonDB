// @flow

import Query from '../../Query'
import encodeQuery from './encodeQuery'
import type { SQL } from './index'

// $FlowFixMe[prop-missing]
Query.prototype._sql = function _sql(count: boolean = false): SQL {
  const query: Query<any> = this
  return encodeQuery(query.serialize(), count)
}
