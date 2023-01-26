// @flow

import type { Descriptor } from '../../utils/common/makeDecorator'

// Wraps function calls in `database.write(() => { ... })`. See docs for more details
// You can use this on Model subclass methods (or methods of any object that has a `database` property)
export function writer(target: Object, key: string, descriptor: Descriptor): Descriptor {
  const actionName = `${target.table}.${key}`
  return {
    ...descriptor,
    value(...args): Promise<any> {
      // $FlowFixMe
      return this.database.write(() => descriptor.value.apply(this, args), actionName)
    },
  }
}

// Wraps function calls in `database.read(() => { ... })`. See docs for more details
// You can use this on Model subclass methods (or methods of any object that has a `database` property)
export function reader(target: Object, key: string, descriptor: Descriptor): Descriptor {
  const actionName = `${target.table}.${key}`
  return {
    ...descriptor,
    value(...args): Promise<any> {
      // $FlowFixMe
      return this.database.read(() => descriptor.value.apply(this, args), actionName)
    },
  }
}

export default function action(target: Object, key: string, descriptor: Descriptor): Descriptor {
  const actionName = `${target.table}.${key}`
  return {
    ...descriptor,
    value(...args): Promise<any> {
      // $FlowFixMe
      return this.database.action(() => descriptor.value.apply(this, args), actionName)
    },
  }
}
