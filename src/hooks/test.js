import React from 'react'
import { renderHook, cleanup } from 'react-hooks-testing-library'
import { useDatabase } from './use-database'
import DatabaseProvider from '../DatabaseProvider'
import Database from '../Database'
import { MockProject, MockTask, MockComment } from '../__tests__/testModels'

describe('useDatabase hook', () => {
  let database
  beforeAll(() => {
    database = new Database({
      adapter: { schema: null },
      modelClasses: [MockProject, MockTask, MockComment],
    })
  })

  afterEach(cleanup)

  test('should use database', () => {
    const wrapper = ({ children }) => (
      <DatabaseProvider database={database}>{children}</DatabaseProvider>
    )
    const { result } = renderHook(() => useDatabase(), { wrapper })
    expect(result.current).toBeInstanceOf(Database)
  })

  test('should throw without Provider', () => {
    const { result } = renderHook(() => useDatabase())
    expect(result.current).toBeUndefined()

    expect(renderHook(() => useDatabase()).toThrow(
      'Could not find database context, please make sure the component is wrapped in the <DatabaseProvider>',
    )
  })
})
