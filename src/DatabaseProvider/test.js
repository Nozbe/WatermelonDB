import React from 'react'
import * as TestRenderer from 'react-test-renderer'
import Database from '../Database'
import { MockProject, MockTask, MockComment } from '../__tests__/testModels'
import DatabaseProvider, { DatabaseConsumer, withDatabase } from '.'

// Simple mock component
function MockComponent() {
  return <span />
}

describe('DatabaseProvider', () => {
  let database
  beforeAll(() => {
    database = new Database({
      adapter: { schema: null },
      modelClasses: [MockProject, MockTask, MockComment],
      actionsEnabled: true,
    })
  })
  it('throws if no database or adapter supplied', () => {
    expect(() => {
      TestRenderer.create(
        <DatabaseProvider>
          <p />
        </DatabaseProvider>,
      )
    }).toThrow(/You must supply a database/i)
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
