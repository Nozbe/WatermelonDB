import React from 'react'
import { compose, withPropsOnChange, withHandlers } from 'recompose'

import withObservables from '@nozbe/with-observables'

import Comment from 'components/Comment'
import Button from 'components/Button'

import style from './style'

const Post = props => {
  const { post, comments, addComment } = props

  return (
    <div>
      <div className={style.title}>{post.title}</div>
      <div className={style.subtitle}>{post.subtitle}</div>
      <div className={style.body}>{post.body}</div>
      <div className={style.comments}>
        <div className={style.commentsTitle}>Comments ({comments.length})</div>
        {comments.map(comment => (
          <Comment comment={comment} key={comment.id} />
        ))}
        <div className={style.addCommentContainer}>
          <Button title="Add comment" onClick={addComment} />
        </div>
      </div>
    </div>
  )
}

const enhance = compose(
  withPropsOnChange(['match'], ({ match }) => ({
    postId: match.params.postId,
  })),
  withObservables(['postId'], ({ postId, database }) => ({
    post: database.collections.get('posts').findAndObserve(postId),
  })),
  withObservables(['post'], ({ post }) => ({
    comments: post.comments.observe(),
  })),
  withHandlers({
    addComment: props => async () => {
      const comment = prompt('Write a comment')
      await props.post.addComment(comment)
    },
  }),
)
export default enhance(Post)
