import React from 'react';
import { Text, FlatList } from 'react-native';
import withObservables from '@nozbe/with-observables';

import Comment from './Comment';
import styles from './helpers/styles';
import prompt from './helpers/prompt';
import Button from './helpers/Button';
import { extractId } from '../utils';

import { Post as PostModel } from '../model/Post.model';
import { Comment as CommentModel } from '../model/Comment.model';

const renderComment = ({ item }: { item: CommentModel }) => <Comment comment={item} key={item.id} />;

function Post({ post, comments }: { post: PostModel, comments: CommentModel[] }) {
  const addComment = async () => {
    const comment = await prompt('Write a comment');
    await post.addComment(comment);
  };

  return (
    <FlatList
      style={styles.marginContainer}
      data={comments}
      renderItem={renderComment}
      ListHeaderComponent={() => (
        <>
          <Text style={styles.title}>{post.title}</Text>
          <Text style={styles.subtitle}>{post.subtitle}</Text>
          <Text style={styles.body}>{post.body}</Text>
          <Text style={styles.subtitle}>Comments ({comments.length})</Text>
        </>
      )}
      ListFooterComponent={() => (
        <Button title="Add comment" onPress={addComment} />
      )}
      keyExtractor={extractId}
    />
  );
}

const enhance = withObservables(['route'], ({ route }) => ({
  post: route.params.post.observe(),
  comments: route.params.post.comments.observe(),
}));

export default enhance(Post);
