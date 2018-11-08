// @flow

import type { Descriptor } from '../../utils/common/makeDecorator'

// TODO: Document me
export default function action(target: Object, key: string, descriptor: Descriptor): Descriptor {
  const actionName = `${target.table}.${key}`
  return {
    ...descriptor,
    value(...args): Promise<any> {
      return this.collection.database.action(() => descriptor.value.apply(this, args), actionName)
    },
  }
}
