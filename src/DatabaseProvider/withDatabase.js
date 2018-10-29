// @flow
import React from 'react'
import type Database from '../Database'
import { DatabaseConsumer } from '.'

type WithDatabaseProps<T> = {
  ...$Exact<T>,
  database: Database,
}
// HoC to inject the database into the props of consumers
export default function withDatabase<T>(
  Component: React$ComponentType<WithDatabaseProps<T>>,
): React$ComponentType<T> {
  return function DatabaseComponent(props): React$Element<any> {
    return <DatabaseConsumer>{database => <Component {...props} database={database} />}</DatabaseConsumer>
  }
}
