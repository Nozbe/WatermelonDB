// @flow
import React from 'react'
import Database from '../Database'

export const DatabaseContext = (React.createContext(): any)
const { Provider, Consumer } = DatabaseContext

export type Props = {
  database: Database,
  children: React$Node,
}

/**
 * Database provider to create the database context
 * to allow child components to consume the database without prop drilling
 */
function DatabaseProvider({ children, database }: Props): React$Element<typeof Provider> {
  if (!database) {
    throw new Error('You must supply a database prop to the DatabaseProvider')
  }
  return <Provider value={database}>{children}</Provider>
}

export { Consumer as DatabaseConsumer }
export { default as withDatabase } from './withDatabase'
export default DatabaseProvider
