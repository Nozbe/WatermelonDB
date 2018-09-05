import React from 'react'
import { compose, withPropsOnChange } from 'recompose'
import withObservables from '@nozbe/with-observables'

import Comment from 'components/Comment'
import style from './style'

const ModerationQueue = ({ blog, nastyComments }) => (
  <div className={style.post}>
    <span className={style.title}>Moderation queue for {blog.name}</span>
    <span className={style.subtitle}>Nasty comments ({nastyComments.length})</span>
    {nastyComments.map(comment => (
      <Comment comment={comment} key={comment.id} />
    ))}
  </div>
)

const enhance = compose(
  withPropsOnChange(['match'], ({ match }) => ({
    blogId: match.params.blogId,
  })),
  withObservables(['id'], ({ blogId, database }) => ({
    blog: database.collections.get('blogs').findAndObserve(blogId),
  })),
  withObservables(['blog'], ({ blog }) => ({
    nastyComments: blog.nastyComments.observe(),
  })),
)

export default enhance(ModerationQueue)
