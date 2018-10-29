// @flow
import React from 'react'
import { DatabaseConsumer } from '.'

type WithDatabaseProps<T> = {
  ...Exact<T>,
  database: Database,
}
// HoC to inject the database into the props of consumers
export default function withDatabase(
  Component: React$ComponentType<WithDatabaseProps<InputProps>>,
): React$ComponentType<InputProps> {
  return function DatabaseComponent(props): React.ComponentType<any> {
    return <DatabaseConsumer>{database => <Component {...props} database={database} />}</DatabaseConsumer>
  }
}
