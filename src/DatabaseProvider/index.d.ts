import { ElementType, ReactNode } from 'react'
import Database from '../Database'
import { Provider } from './DatabaseContext'

export type Props = {
  database: Database
  children: ReactNode
}

/**
 * Database provider to create the database context
 * to allow child components to consume the database without prop drilling
 */
declare function DatabaseProvider({ children, database }: Props): ElementType<Provider>

export { default as withDatabase } from './withDatabase'
export { default as DatabaseContext, DatabaseConsumer } from './DatabaseContext'
export default DatabaseProvider
