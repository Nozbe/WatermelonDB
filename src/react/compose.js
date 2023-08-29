// @flow

const compose: any =
  (...funcs) =>
  (Component) => {
    const enhance = funcs.reduce(
      (a, b) =>
        (...args) =>
          a(b(...args)),
      (arg) => arg,
    )
    const EnhancedComponent = enhance(Component)
    EnhancedComponent.displayName = `${Component.name}.Enhanced`
    return EnhancedComponent
  }

export default (compose: $Compose)
