import React from 'react';
import { FlatList, Text } from 'react-native';
import withObservables from '@nozbe/with-observables';

import Comment from './Comment';
import styles from './helpers/styles';
import { extractId } from '../utils';

import { Blog } from '../model/Blog.model';
import { Comment as CommentModel } from '../model/Comment.model';

const renderComment = ({ item }: { item: CommentModel }) => <Comment comment={item} key={item.id} />;

const ModerationQueue = ({ blog, nastyComments }: { blog: Blog, nastyComments: CommentModel[] }) => (
  <FlatList
    ListHeaderComponent={() => (
      <>
        <Text style={styles.title}>Moderation queue for {blog.name}</Text>
        <Text style={styles.subtitle}>Nasty comments ({nastyComments.length})</Text>
      </>
    )}
    data={nastyComments}
    renderItem={renderComment}
    keyExtractor={extractId}
  />
);

const enhance = withObservables(['route'], ({ route }) => ({
  blog: route.params.blog.observe(),
  nastyComments: route.params.blog.nastyComments.observe(),
}));

export default enhance(ModerationQueue);
