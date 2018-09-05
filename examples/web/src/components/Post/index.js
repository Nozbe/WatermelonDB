import React, { Component } from 'react'
import { compose, withPropsOnChange } from 'recompose'

import withObservables from '@nozbe/with-observables'

import Comment from 'components/Comment'
import Button from 'components/Button'

import style from './style'

class Post extends Component {
  addComment = async () => {
    const comment = prompt('Write a comment')
    await this.props.post.addComment(comment)
  }

  render() {
    const { post, comments } = this.props
    return (
      <div className={style.post}>
        <span className={style.title}>{post.title}</span>
        <span className={style.subtitle}>{post.subtitle}</span>
        <span className={style.body}>{post.body}</span>
        <span className={style.subtitle}>Comments ({comments.length})</span>
        {comments.map(comment => (
          <Comment comment={comment} key={comment.id} />
        ))}
        <Button title="Add comment" onClick={this.addComment} />
      </div>
    )
  }
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
)
export default enhance(Post)
