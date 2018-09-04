import React from 'react'
import { Text, View } from 'react-native'
import withObservables from '@nozbe/with-observables'

import styles from './helpers/styles'

const RawComment = ({ comment }) => (
  <View style={styles.comment}>
    <Text>
      {comment.isNasty && '☹️ '}
      {comment.body}
    </Text>
  </View>
)

const enhance = withObservables(['comment'], ({ comment }) => ({
  comment: comment.observe(),
}))

export default enhance(RawComment)
