// @flow
import React from 'react'
import DatabaseContext from '../DatabaseProvider/DatabaseContext'
import invariant from '../utils/common/invariant'

import type Database from '../Database'

export function useDatabase(): Database {
  const database = React.useContext(DatabaseContext)

  invariant(
    database,
    'Could not find database context, please make sure the component is wrapped in the <DatabaseProvider>',
  )

  return database
}
