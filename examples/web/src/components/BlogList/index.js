import React from 'react'

import withObservables from '@nozbe/with-observables'

import ListItem from 'components/ListItem'

const RawBlogItem = ({ blog, to }) => (
  <ListItem title={blog.name} countObservable={blog.posts.observeCount()} to={to} />
)

const BlogItem = withObservables(['blog'], ({ blog }) => ({
  blog: blog.observe(),
}))(RawBlogItem)

const BlogList = ({ blogs }) => (
  <div>
    {blogs.map(blog => (
      <BlogItem blog={blog} key={blog.id} to={`/blog/${blog.id}`} />
    ))}
  </div>
)

const enhance = withObservables([], ({ database }) => ({
  blogs: database.collections
    .get('blogs')
    .query()
    .observe(),
}))

export default enhance(BlogList)
