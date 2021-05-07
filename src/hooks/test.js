import React from 'react'
import * as TestRenderer from 'react-test-renderer'
import { renderHook } from '@testing-library/react-hooks'
import { useDatabase } from './use-database'
import DatabaseProvider from '../DatabaseProvider'
import Database from '../Database'
import { mockDatabase } from '../__tests__/testModels'

// Note: this uses two testing libraries; react-test-renderer and @testing-library/react-hooks.
// This is probably overkill for such a simple hook but I will leave these here in case more
// hooks are added in the future.

describe('useDatabase hook', () => {
  let database
  beforeAll(() => {
    database = mockDatabase().db
  })
  test('should use database', () => {
    const wrapper = ({ children }) => (
      <DatabaseProvider database={database}>{children}</DatabaseProvider>
    )
    const { result } = renderHook(() => useDatabase(), { wrapper })
    expect(result.current).toBeInstanceOf(Database)
  })
  test('should throw without Provider', () => {
    const Component = () => {
      useDatabase()
    }
    expect(() => {
      TestRenderer.create(<Component />)
    }).toThrow(
      /Could not find database context, please make sure the component is wrapped in the <DatabaseProvider>/i,
    )
  })
})
