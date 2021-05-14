// @flow

import type { Descriptor } from '../../utils/common/makeDecorator'

// Wraps function calls in `database.action(() => { ... })`. See docs for more details
// You can use this on Model subclass methods (or methods of any object that has a `database` property)
export default function action(target: Object, key: string, descriptor: Descriptor): Descriptor {
  const actionName = `${target.table}.${key}`
  return {
    ...descriptor,
    value(...args): Promise<any> {
      return this.database.action(() => descriptor.value.apply(this, args), actionName)
    },
  }
}

export function writer(target: Object, key: string, descriptor: Descriptor): Descriptor {
  const actionName = `${target.table}.${key} (writer)`
  return {
    ...descriptor,
    value(...args): Promise<any> {
      return this.database.write(() => descriptor.value.apply(this, args), actionName)
    },
  }
}

export function reader(target: Object, key: string, descriptor: Descriptor): Descriptor {
  const actionName = `${target.table}.${key} (reader)`
  return {
    ...descriptor,
    value(...args): Promise<any> {
      return this.database.read(() => descriptor.value.apply(this, args), actionName)
    },
  }
}
