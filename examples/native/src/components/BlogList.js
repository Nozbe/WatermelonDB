import React from 'react'
import { View } from 'react-native'

import withObservables from '@nozbe/with-observables'

import ListItem from './helpers/ListItem'

const RawBlogItem = ({ blog, onPress }) => (
  <ListItem title={blog.name} countObservable={blog.posts.observeCount()} onPress={onPress} />
)

const BlogItem = withObservables(['blog'], ({ blog }) => ({
  blog: blog.observe(),
}))(RawBlogItem)

const BlogList = ({ blogs, navigation }) => (
  <View>
    {blogs.map(blog => (
      <BlogItem blog={blog} key={blog.id} onPress={() => navigation.navigate('Blog', { blog })} />
    ))}
  </View>
)

const enhance = withObservables([], ({ database }) => ({
  blogs: database.collections
    .get('blogs')
    .query()
    .observe(),
}))

export default enhance(BlogList)
