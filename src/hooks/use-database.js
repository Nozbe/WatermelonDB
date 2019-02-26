// @flow
import { useContext } from 'react'
import { DatabaseContext } from '../DatabaseProvider'
import Database from '../Database'
import invariant from '../utils/common/invariant'

import type DatabaseType from '../Database'

export function useDatabase(): DatabaseType {
  const database = useContext(DatabaseContext)
  invariant(
    typeof database !== typeof Database,
    'Could not find database context, please make sure the component is wrapped in the <DatabaseProvider>',
  )
  return database
}
