import React from 'react'
import withObservables from '@nozbe/with-observables'

import style from './style'

const RawComment = ({ comment }) => (
  <div className={style.root}>
    {comment.isNasty && '☹️ '}
    {comment.body}
  </div>
)

const enhance = withObservables(['comment'], ({ comment }) => ({
  comment: comment.observe(),
}))

export default enhance(RawComment)
