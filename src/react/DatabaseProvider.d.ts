import { ReactNode } from 'react'
import Database from '../Database'

export type Props = {
  database: Database
  children: ReactNode
}

/**
 * Database provider to create the database context
 * to allow child components to consume the database without prop drilling
 */
declare function DatabaseProvider({ children, database }: Props): JSX.Element

export { default as withDatabase } from './withDatabase'
export { default as DatabaseContext, DatabaseConsumer } from './DatabaseContext'
export default DatabaseProvider
