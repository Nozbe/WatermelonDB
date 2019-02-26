// @flow
import { useContext } from 'react'
import { DatabaseContext } from '../DatabaseProvider'
import type Database from '../Database'

export function useDatabase(): Database {
  const database = useContext(DatabaseContext)
  return database
}
