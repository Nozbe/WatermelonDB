import React from 'react'
import { Text, TouchableOpacity } from 'react-native'
import withObservables from '@nozbe/with-observables'

import styles from './styles'

// We observe and render the counter in a separate component so that we don't have to wait for the database
// until we can render the component. You can also prefetch all data before displaying the list
const RawCounter = ({ count }) => count

const Counter = withObservables(['observable'], ({ observable }) => ({
  count: observable,
}))(RawCounter)

const ListItem = ({ title, countObservable, onPress }) => (
  <TouchableOpacity onPress={onPress} style={styles.listItem}>
    <Text style={styles.listItemTitle} numberOfLines={1}>
      {title}
    </Text>
    <Text style={styles.listItemCounter}>
      <Counter observable={countObservable} />
    </Text>
  </TouchableOpacity>
)

export default ListItem
