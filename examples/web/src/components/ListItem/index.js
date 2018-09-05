import React from 'react'
import { Link } from 'react-router-dom'
import withObservables from '@nozbe/with-observables'

import style from './style'

// We observe and render the counter in a separate component so that we don't have to wait for the database
// until we can render the component. You can also prefetch all data before displaying the list
const RawCounter = ({ count }) => count

const Counter = withObservables(['observable'], ({ observable }) => ({
  count: observable,
}))(RawCounter)

const ListItem = ({ title, countObservable, to }) => (
  <Link to={to} className={style.root}>
    <span className={style.title}>{title}</span>
    <span className={style.conunter}>
      <Counter observable={countObservable} />
    </span>
  </Link>
)

export default ListItem
