import React from 'react'
import { ScrollView, Text, SafeAreaView, FlatList } from 'react-native'
import withObservables from '@nozbe/with-observables'

import Comment from './Comment'
import styles from './helpers/styles'
import { extractId } from '../utils'

const renderComment = ({ item }) => <Comment comment={item} key={item.id} />

const ModerationQueue = ({ blog, nastyComments }) => (
  <ScrollView style={styles.container}>
    <SafeAreaView>
      <Text style={styles.title}>Moderation queue for {blog.name}</Text>
      <Text style={styles.subtitle}>Nasty comments ({nastyComments.length})</Text>
      <FlatList data={nastyComments} renderItem={renderComment} keyExtractor={extractId} />
    </SafeAreaView>
  </ScrollView>
)

const enhance = withObservables(['blog'], ({ blog }) => ({
  blog: blog.observe(),
  nastyComments: blog.nastyComments.observe(),
}))

export default enhance(ModerationQueue)
