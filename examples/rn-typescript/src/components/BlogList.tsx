import React from 'react';
import { View } from 'react-native';

import { Q } from '@nozbe/watermelondb';
import withObservables from '@nozbe/with-observables';

import ListItem from './helpers/ListItem';

import { Blog } from '../model/Blog.model';
import { RootProps } from '../types';

const RawBlogItem = ({ blog, onPress }: { blog: Blog, onPress: () => void}) => (
  <ListItem title={blog.name} countObservable={blog.posts.observeCount()} onPress={onPress} />
);

const BlogItem = withObservables(['blog'], ({ blog }) => ({
  blog: blog.observe(),
}))(RawBlogItem);

type BlogListProps = { blogs: Blog[], navigation: RootProps['navigation']}

const BlogList = ({ blogs, navigation }: BlogListProps) => (
  <View>
    {blogs.map((blog) => (
      <BlogItem
        blog={blog}
        key={blog.id}
        onPress={() => {
          console.log({ blog });
          return navigation.navigate('Blog', { blog });
        }}
      />
    ))}
  </View>
);

// 'database isn't needed in the first array arg, 
// but for typescript the second arg's valid properties in enhance signature
// seem to be based on first arg array
const enhance = withObservables(['search', 'database'], ({ database, search }) => ({
  blogs: database.collections
    .get('blogs')
    .query(Q.where('name', Q.like(`%${Q.sanitizeLikeString(search)}%`))),
}));

export default enhance(BlogList);
