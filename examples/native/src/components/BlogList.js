import React from 'react'
import { View } from 'react-native'

import { Q } from '@nozbe/watermelondb'
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
const enhance = withObservables(['search'], ({ database, search }) => ({
  blogs: database.collections
    .get('blogs')
    .query(Q.where('name', Q.like(`%${Q.sanitizeLikeString(search)}%`))),
}))

export default enhance(BlogList)
