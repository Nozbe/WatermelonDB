// @flow

import makeDecorator, { type Decorator } from '../../utils/common/makeDecorator'
import invariant from '../../utils/common/invariant'

// Marks a model field as immutable after create — you can set and change the value in
// create() and prepareCreate(), but after it's saved to the database, it cannot be changed

const nochange: Decorator = makeDecorator(
  () => (target: Object, key: string, descriptor: Object) => {
    invariant(
      descriptor.set,
      `@nochange can only be applied to model fields (to properties with a setter)`,
    )

    const errorMessage = `Attempt to set a new value on a @nochange field: ${target.constructor.name}.prototype.${key}`

    return {
      ...descriptor,
      set(value: any): void {
        invariant(this.asModel._preparedState === 'create', errorMessage)
        descriptor.set.call(this, value)
      },
    }
  },
)

export default nochange
