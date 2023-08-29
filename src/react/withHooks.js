// @flow
import { type HOC, createFactory } from './helpers'

type GetNewProps = <T: { ... }>(T) => T
type Props$Merge<A, B> = { ...$Exact<A>, ...$Exact<B> }
type EnhancedProps<PropsInput, NewProps> = Props$Merge<PropsInput, $Call<GetNewProps, NewProps>>

export default function withHooks<PropsInput: { ... }, NewProps: { ... }>(
  hookTransformer: (props: PropsInput) => NewProps,
): HOC<EnhancedProps<PropsInput, NewProps>, PropsInput> {
  return (BaseComponent) => {
    const factory = createFactory(BaseComponent)
    const enhanced = function WithHooks(props: any): any {
      const newProps = hookTransformer(props)
      return factory({ ...props, ...newProps })
    }
    if (process.env.NODE_ENV !== 'production') {
      const baseName = BaseComponent.displayName || BaseComponent.name || 'anon'
      // $FlowFixMe
      enhanced.displayName = `withHooks[${baseName}]`
    }
    return enhanced
  }
}
