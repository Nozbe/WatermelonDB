// @flow
import { createFactory as reactCreateFactory } from 'react'

export type HOC<Base, Enhanced> = (React$ComponentType<Base>) => React$ComponentType<Enhanced>

let _createFactory: any = reactCreateFactory

// undocumented binding for NT perf hack
export function _setCreateFactory(newCreateFactory: any): void {
  _createFactory = newCreateFactory
}

export function createFactory<ElementType: React$ElementType>(
  Component: ElementType,
): React$ElementFactory<ElementType> {
  return _createFactory(Component)
}
