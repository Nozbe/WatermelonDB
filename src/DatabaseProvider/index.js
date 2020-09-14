// @flow
import React from 'react'
import Database from '../Database'
import { Provider } from './DatabaseContext'

export type Props = {
  database: Database,
  children: React$Node,
}

/**
 * Database provider to create the database context
 * to allow child components to consume the database without prop drilling
 */
function DatabaseProvider({ children, database }: Props): React$Element<typeof Provider> {
  if (!(database instanceof Database)) {
    throw new Error('You must supply a valid database prop to the DatabaseProvider')
  }
  return <Provider value={database}>{children}</Provider>
}

export { default as withDatabase } from './withDatabase'
export default DatabaseProvider
