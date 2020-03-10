import React from 'react'
import { compose, withPropsOnChange } from 'recompose'
import withObservables from '@nozbe/with-observables'
import { withDatabase } from '@nozbe/watermelondb/DatabaseProvider'

import Comment from 'components/Comment'
import BackLink from 'components/BackLink'
import style from './style'

const ModerationQueue = ({ blog, nastyComments, hideMain, match }) => (
  <React.Fragment>
    <BackLink to={`/blog/${match.params.blogId}`} onClick={hideMain}>&lt; Back</BackLink>
    <div className={style.queueBlock}>
        <span className={style.title}>Moderation queue for {blog.name}</span>
        <span className={style.subtitle}>Nasty comments ({nastyComments.length})</span>
        {nastyComments.map(comment => (
            <Comment comment={comment} key={comment.id} />
        ))}
    </div>
  </React.Fragment>
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

export default withDatabase(enhance(ModerationQueue))
