import * as React from 'react'
import withObservables from './index'

describe('withObservables', () => {
  it('should hoist non react statics', () => {
    class A extends React.PureComponent {
      static nonReactProp = 'temp_string'
      render() {
        return null
      }
    }
    const getObservables = () => {}
    const WrappedComponent = withObservables([], getObservables)(A)
    expect(WrappedComponent.nonReactProp).toBe(A.nonReactProp)
  })
})
