import React from 'react'
import { compose, withPropsOnChange, withHandlers, withStateHandlers } from 'recompose'
import withObservables from '@nozbe/with-observables'

import Button from 'components/Button'
import ListItem from 'components/ListItem'

import style from './style'

const RowNastyCommentsItem = ({ blog, to, isActive, onClick }) => (
  <ListItem title="Nasty comments"
    countObservable={blog.nastyComments.observeCount()}
    to={to}
    isActive={isActive}
    onClick={onClick} />
)

const RawPostItem = ({ post, to, onClick, isActive }) => (
  <ListItem title={post.title}
    countObservable={post.comments.observeCount()}
    to={to}
    isActive={isActive}
    onClick={onClick} />
)

const PostItem = compose(
  withObservables(['post'], ({ post }) => ({
    post: post.observe(),
  })),
  withHandlers({
    onClick: ({ onClick, post, showMain }) => e => {
      onClick(e, post.id)
      showMain()
    },
  }),
)(RawPostItem)

const NastyCommentsItem = compose(
  withHandlers({
    onClick: ({ onClick, blog, showMain }) => e => {
      onClick(e, blog.id)
      showMain()
    },
  }),
)(RowNastyCommentsItem)

const Blog = props => {
  const { blog, posts, moderate, setActiveItem, activeItem, showMain } = props

  return (
    <div className={style.root}>
      <div className={style.postLength}>
        <span>Posts: {posts.length}</span>
        <Button title="Moderate" onClick={moderate} />
      </div>
      <NastyCommentsItem blog={blog}
        to={`/blog/${blog.id}/nasty/${blog.id}`}
        isActive={blog.id === activeItem}
        onClick={setActiveItem}
        showMain={showMain}
      />
      {posts.map(post => (
        <PostItem post={post}
          key={post.id}
          to={`/blog/${blog.id}/post/${post.id}`}
          isActive={post.id === activeItem}
          onClick={setActiveItem}
          showMain={showMain}
        />
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
  withStateHandlers(
    {
      activeItem: null,
    },
    {
      setActiveItem: () => (e, postId) => ({
        activeItem: postId,
      }),
    },
  ),
  withHandlers({
    moderate: props => async () => {
      await props.blog.moderateAll()
    },
  }),
)

export default enhance(Blog)
