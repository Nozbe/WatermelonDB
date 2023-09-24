import React from 'react';
import { FlatList, Text } from 'react-native';
import withObservables from '@nozbe/with-observables';

import Button from './helpers/Button';
import ListItem from './helpers/ListItem';
import styles from './helpers/styles';
import { extractId } from '../utils';

import { Blog as BlogModel } from '../model/Blog.model';
import { BlogProps as NavBlogProps } from '../types'
import { Post } from '../model/Post.model';

const NastyCommentsItem = ({ blog, onPress }: { blog: BlogModel, onPress: () => void }) => (
  <ListItem
    title="Nasty comments"
    countObservable={blog.nastyComments.observeCount()}
    onPress={onPress}
  />
);

const RawPostItem = ({ post, onPress }: { post: Post, onPress: () => void }) => (
  <ListItem title={post.title} countObservable={post.comments.observeCount()} onPress={onPress} />
);

const PostItem = withObservables(['post'], ({ post }) => ({
  post: post.observe(),
}))(RawPostItem);

type BlogProps = { blog: BlogModel, posts: Post[], navigation: NavBlogProps['navigation']}

function Blog({ blog, posts, navigation }: BlogProps) {

  const moderate = async () => {
    await blog.moderateAll();
  };

  return (
    <FlatList
      data={posts}
      renderItem={({ item: post }) => (
        <PostItem
          post={post}
          key={post.id}
          onPress={() => navigation.navigate('Post', { post })}
        />
      )}
      ListHeaderComponent={() => (
        <>
          <Button title="Moderate" onPress={moderate} />
          <NastyCommentsItem
            blog={blog}
            onPress={() => navigation.navigate('ModerationQueue', { blog })}
          />
          <Text style={styles.postsListHeader}>Posts: {posts.length}</Text>
        </>
      )}
      keyExtractor={extractId}
    />
  )
}

const enhance = withObservables(['route'], ({ route }) => ({
  blog: route.params.blog.observe(),
  posts: route.params.blog.posts.observe(),
}));

export default enhance(Blog);
