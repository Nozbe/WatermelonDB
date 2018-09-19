import React, { Component } from 'react'
import { ScrollView, Text, SafeAreaView, FlatList, View } from 'react-native'
import withObservables from '@nozbe/with-observables'

import Comment from './Comment'
import styles from './helpers/styles'
import prompt from './helpers/prompt'
import Button from './helpers/Button'
import { extractId } from '../utils'

const renderComment = ({ item }) => <Comment comment={item} key={item.id} />

class Post extends Component {
  addComment = async () => {
    const comment = await prompt('Write a comment')
    await this.props.post.addComment(comment)
  }

  render() {
    const { post, comments } = this.props
    return (
      <ScrollView>
        <SafeAreaView style={styles.container}>
          <Text style={styles.title}>{post.title}</Text>
          <Text style={styles.subtitle}>{post.subtitle}</Text>
          <Text style={styles.body}>{post.body}</Text>
          <Text style={styles.subtitle}>Comments ({comments.length})</Text>
          <FlatList style={styles.marginContainer}
            data={comments}
            renderItem={renderComment}
            keyExtractor={extractId} />
          <Button style={styles.button} title="Add comment" onPress={this.addComment} />
        </SafeAreaView>
      </ScrollView>
    )
  }
}

const enhance = withObservables(['post'], ({ post }) => ({
  post: post.observe(),
  comments: post.comments.observe(),
}))

export default enhance(Post)
