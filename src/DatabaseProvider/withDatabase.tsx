import React from 'react'
import type Database from '../Database'
import { DatabaseConsumer } from './DatabaseContext'

type WithDatabaseProps = {
  database: Database,
}

// HoC to inject the database into the props of consumers
export default function withDatabase(
  Component: React.ComponentType<WithDatabaseProps>,
): React.ComponentType<any> {
  return function DatabaseComponent(props: Record<any, any>): React.ReactElement<any> {
    return (
      <DatabaseConsumer>
        {(database: Database) => <Component {...props} database={database} />}
      </DatabaseConsumer>
    )
  }
}
