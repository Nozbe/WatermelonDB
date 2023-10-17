import React from 'react';
import withObservablesSynchronized from '@nozbe/with-observables';

import { View, Text } from 'react-native';
import { Comment as CommentModel } from '../model/Comment.model';

const Comment = ({ comment }: { comment: CommentModel}) => (
  <View>
    <Text>{comment.body}</Text>
  </View>
);

const enhance = withObservablesSynchronized(['comment'], ({ comment }) => ({
  comment,
}));

const EnhancedComment = enhance(Comment);

export default EnhancedComment;
