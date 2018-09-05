import React from 'react'
import { compose, withPropsOnChange, withHandlers } from 'recompose'
import withObservables from '@nozbe/with-observables'

import Button from 'components/Button'
import ListItem from 'components/ListItem'

import style from './style'

const NastyCommentsItem = ({ blog, to }) => (
  <ListItem title="Nasty comments" countObservable={blog.nastyComments.observeCount()} to={to} />
)

const RawPostItem = ({ post, to }) => (
  <ListItem title={post.title} countObservable={post.comments.observeCount()} to={to} />
)

const PostItem = withObservables(['post'], ({ post }) => ({
  post: post.observe(),
}))(RawPostItem)

const Blog = props => {
  const { blog, posts, moderate } = props

  return (
    <div className={style.root}>
      <div className={style.postLength}>Posts: {posts.length}</div>
      <Button title="Moderate" onClick={moderate} />
      <NastyCommentsItem blog={blog} to={`/blog/${blog.id}/nasty/${blog.id}`} />
      {posts.map(post => (
        <PostItem post={post} key={post.id} to={`/blog/${blog.id}/post/${post.id}`} />
      ))}
    </div>
  )
}

const enhance = compose(
  withPropsOnChange(['match'], ({ match }) => ({
    blogId: match.params.blogId,
  })),
  withObservables(['id'], ({ blogId, database }) => ({
    blog: database.collections.get('blogs').findAndObserve(blogId),
  })),
  withObservables(['blog'], ({ blog }) => ({
    posts: blog.posts.observe(),
  })),
  withHandlers({
    moderate: props => async () => {
      await props.blog.moderateAll()
    },
  }),
)

export default enhance(Blog)
