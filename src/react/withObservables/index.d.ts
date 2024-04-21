import { ComponentType, NamedExoticComponent } from 'react'
import { Observable } from 'rxjs'
import hoistNonReactStatics = require('hoist-non-react-statics')

interface ObservableConvertible<T> {
  readonly observe: () => Observable<T>
}

type ExtractObservableType<T> =
  T extends Observable<infer U> ? U : T extends ObservableConvertible<infer U> ? U : T

export type ExtractedObservables<T> = {
  [K in keyof T]: ExtractObservableType<T[K]>
}

/**
 * A property P will be present if:
 * - it is present in DecorationTargetProps
 *
 * Its value will be dependent on the following conditions
 * - if property P is present in InjectedProps and its definition extends the definition
 *   in DecorationTargetProps, then its definition will be that of DecorationTargetProps[P]
 * - if property P is not present in InjectedProps then its definition will be that of
 *   DecorationTargetProps[P]
 * - if property P is present in InjectedProps but does not extend the
 *   DecorationTargetProps[P] definition, its definition will be that of InjectedProps[P]
 */
type Matching<InjectedProps, DecorationTargetProps> = {
  [P in keyof DecorationTargetProps]: P extends keyof InjectedProps
    ? InjectedProps[P] extends DecorationTargetProps[P]
      ? DecorationTargetProps[P]
      : InjectedProps[P]
    : DecorationTargetProps[P]
}

// Infers prop type from component C
type GetProps<C> = C extends ComponentType<infer P> ? P : never

/**
 * a property P will be present if :
 * - it is present in both DecorationTargetProps and InjectedProps
 * - InjectedProps[P] can satisfy DecorationTargetProps[P]
 * ie: decorated component can accept more types than decorator is injecting
 *
 * For decoration, inject props or ownProps are all optionally
 * required by the decorated (right hand side) component.
 * But any property required by the decorated component must be satisfied by the injected property.
 */
type Shared<InjectedProps, DecorationTargetProps> = {
  [P in Extract<
    keyof InjectedProps,
    keyof DecorationTargetProps
  >]?: InjectedProps[P] extends DecorationTargetProps[P] ? DecorationTargetProps[P] : never
}

// Applies LibraryManagedAttributes (proper handling of defaultProps
// and propTypes), as well as defines WrappedComponent.
type ConnectedComponent<C extends ComponentType<any>, P> = NamedExoticComponent<
  JSX.LibraryManagedAttributes<C, P>
> &
  hoistNonReactStatics.NonReactStatics<C> & {
    WrappedComponent: C
  }

// Injects props and removes them from the prop requirements.
// Will not pass through the injected props if they are passed in during
// render. Also adds new prop requirements from TNeedsProps.
type InferableComponentEnhancer<TInjectedProps, TNeedsProps> = <
  C extends ComponentType<Matching<TInjectedProps, GetProps<C>>>,
>(
  component: C,
) => ConnectedComponent<
  C,
  Omit<GetProps<C>, keyof Shared<TInjectedProps, GetProps<C>>> & TNeedsProps
>

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>
type ObservableifyProps<T, O extends keyof T, C extends keyof T = never> = {
  [K in keyof Pick<T, O>]: Observable<T[K]>
} & {
  [K in keyof Pick<T, C>]: ObservableConvertible<T[K]>
} & Omit<T, O | C>

export default function withObservables<InputProps, ObservableProps>(
  triggerProps: Array<keyof InputProps>,
  getObservables: (props: InputProps) => ObservableProps,
): InferableComponentEnhancer<ExtractedObservables<ObservableProps>, InputProps>
