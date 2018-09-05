import React from 'react'
import withObservables from '@nozbe/with-observables'

import style from './style'

const RawComment = ({ comment }) => (
  <div style={style.root}>
    <span>
      {comment.isNasty && '☹️ '}
      {comment.body}
    </span>
  </div>
)

const enhance = withObservables(['comment'], ({ comment }) => ({
  comment: comment.observe(),
}))

export default enhance(RawComment)
