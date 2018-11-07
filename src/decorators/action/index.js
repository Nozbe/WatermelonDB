// @flow

import type { Descriptor } from '../../utils/common/makeDecorator'

export default function action(target: Object, key: string, descriptor: Descriptor): Descriptor {
  const actionName = `${target.table}.${key}`
  return {
    ...descriptor,
    value(): Promise<any> {
      return this.collection.database.action(descriptor.value.bind(this))
    },
  }
}
