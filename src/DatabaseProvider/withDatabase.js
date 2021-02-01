// @flow
import React from 'react'
import type Database from '../Database'
import { DatabaseConsumer } from './DatabaseContext'

type WithDatabaseProps<T: {}> = {
  ...T,
  database: Database,
}
// HoC to inject the database into the props of consumers
export default function withDatabase<T: {}>(
  Component: React$ComponentType<WithDatabaseProps<T>>,
): React$ComponentType<T> {
  return function DatabaseComponent(props): React$Element<*> {
    return <DatabaseConsumer>{(database: Database) => <Component {...props} database={database} />}</DatabaseConsumer>
  }
}
