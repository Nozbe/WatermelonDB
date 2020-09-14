import React from 'react'
import * as TestRenderer from 'react-test-renderer'
import Database from '../Database'
import { mockDatabase } from '../__tests__/testModels'
import DatabaseProvider from '.'
import { DatabaseConsumer } from './DatabaseContext'
import withDatabase from './withDatabase'

// Simple mock component
function MockComponent() {
  return <span />
}

describe('DatabaseProvider', () => {
  let database
  beforeAll(() => {
    database = mockDatabase({ actionsEnabled: true }).db
  })
  it('throws if no database or adapter supplied', () => {
    expect(() => {
      TestRenderer.create(
        <DatabaseProvider>
          <p />
        </DatabaseProvider>,
      )
    }).toThrow(/You must supply a valid database/i)
    expect(() => {
      TestRenderer.create(
        <DatabaseProvider database={{ fake: 'db' }}>
          <p />
        </DatabaseProvider>,
      )
    }).toThrow(/You must supply a valid database/i)
  })
  it('passes database to consumer', () => {
    const instance = TestRenderer.create(
      <DatabaseProvider database={database}>
        <DatabaseConsumer>{db => <MockComponent database={db} />}</DatabaseConsumer>
      </DatabaseProvider>,
    )
    const component = instance.root.find(MockComponent)
    expect(component.props.database).toBeInstanceOf(Database)
  })

  describe('withDatabase', () => {
    test('should pass the database from the context to the consumer', () => {
      const Child = withDatabase(MockComponent)
      const instance = TestRenderer.create(
        <DatabaseProvider database={database}>
          <Child />
        </DatabaseProvider>,
      )
      const component = instance.root.find(MockComponent)
      expect(component.props.database).toBeInstanceOf(Database)
    })
  })
})
