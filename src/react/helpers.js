// @flow
import { createElement } from 'react'

export type HOC<Base, Enhanced> = (React$ComponentType<Base>) => React$ComponentType<Enhanced>

let _createFactory: any = (Component) => {
  // eslint-disable-next-line react/function-component-definition, react/display-name
  return (props) => createElement(Component, props)
}

// undocumented binding for NT perf hack
export function _setCreateFactory(newCreateFactory: any): void {
  _createFactory = newCreateFactory
}

export function createFactory<ElementType: React$ElementType>(
  Component: ElementType,
): React$ElementFactory<ElementType> {
  return _createFactory(Component)
}
