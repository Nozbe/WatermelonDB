import React, { Component } from 'react';
import { FlatList, Text } from 'react-native';
import withObservables from '@nozbe/with-observables';

import Button from './helpers/Button';
import ListItem from './helpers/ListItem';
import styles from './helpers/styles';
import { extractId } from '../utils';

const NastyCommentsItem = ({ blog, onPress }) => (
  <ListItem
    title="Nasty comments"
    countObservable={blog.nastyComments.observeCount()}
    onPress={onPress}
  />
);

const RawPostItem = ({ post, onPress }) => (
  <ListItem title={post.title} countObservable={post.comments.observeCount()} onPress={onPress} />
);

const PostItem = withObservables(['post'], ({ post }) => ({
  post: post.observe(),
}))(RawPostItem);

class Blog extends Component {
  moderate = async () => {
    await this.props.blog.moderateAll();
  };

  render() {
    const { blog, posts, navigation } = this.props;
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
            <Button style={styles.button} title="Moderate" onPress={this.moderate} />
            <NastyCommentsItem
              blog={blog}
              onPress={() => navigation.navigate('ModerationQueue', { blog })}
            />
            <Text style={styles.postsListHeader}>Posts: {posts.length}</Text>
          </>
        )}
        keyExtractor={extractId}
      />
    );
  }
}

const enhance = withObservables(['route'], ({ route }) => ({
  blog: route.params.blog.observe(),
  posts: route.params.blog.posts.observe(),
}));

export default enhance(Blog);
