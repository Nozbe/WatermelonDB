import React from 'react'
import { compose, withStateHandlers, withHandlers } from 'recompose'
import { Q } from '@nozbe/watermelondb'
import withObservables from '@nozbe/with-observables'

import ListItem from 'components/ListItem'

import style from './style'

const RawBlogItem = ({ blog, to, onClick, isActive }) => (
  <ListItem title={blog.name}
    countObservable={blog.posts.observeCount()}
    to={to}
    isActive={isActive}
    onClick={onClick} />
)

const BlogItem = compose(
  withObservables(['blog'], ({ blog }) => ({
    blog: blog.observe(),
  })),
  withHandlers({
    onClick: ({ onClick, blog }) => e => {
      onClick(e, blog.id)
    },
  }),
)(RawBlogItem)

const BlogList = ({ blogs, setActiveItem, activeItem }) => (
  <div className={style.root}>
    {blogs.map(blog => (
      <BlogItem blog={blog}
        key={blog.id}
        to={`/blog/${blog.id}`}
        isActive={blog.id === activeItem}
        onClick={setActiveItem} />
    ))}
    {!blogs.length && <span className={style.placeholder}>Click “Generate x records” above!</span>}
  </div>
)

const enhance = compose(
  withObservables(['search'], ({ database, search }) => ({
    blogs: database.collections
      .get('blogs')
      .query(Q.where('name', Q.like(`%${Q.sanitizeLikeString(search)}%`))),
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
)

export default enhance(BlogList)
