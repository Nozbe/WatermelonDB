// @flow
/* eslint-disable react/no-direct-mutation-state */
/* eslint-disable react/sort-comp */

import type { Observable } from 'rxjs'
import { Component, createElement } from 'react'
import hoistNonReactStatics from 'hoist-non-react-statics'

import scheduleForCleanup from './garbageCollector'

type UnaryFn<A, R> = (a: A) => R
type HOC<Base, Enhanced> = UnaryFn<React$ComponentType<Base>, React$ComponentType<Enhanced>>

export interface ObservableConvertible<T> {
  observe(): Observable<T>;
}

export type ExtractTypeFromObservable = <T>(value: Observable<T> | ObservableConvertible<T>) => T

type TriggerProps<A> = $Keys<A>[] | null
type GetObservables<A, B> = (props: A) => B

type WithObservables<Props, ObservableProps> = HOC<
  { ...$Exact<Props>, ...$ObjMap<ObservableProps, ExtractTypeFromObservable> },
  Props,
>

type Unsubscribe = () => void

function subscribe(
  value: any,
  onNext: (any) => void,
  onError: (Error) => void,
  onComplete: () => void,
): Unsubscribe {
  const wmelonTag = value && value.constructor && value.constructor._wmelonTag
  if (wmelonTag === 'model') {
    onNext(value)
    return value.experimentalSubscribe((isDeleted) => {
      if (isDeleted) {
        onComplete()
      } else {
        onNext(value)
      }
    })
  } else if (wmelonTag === 'query') {
    return value.experimentalSubscribe(onNext)
  } else if (typeof value.observe === 'function') {
    const subscription = value.observe().subscribe(onNext, onError, onComplete)
    return () => subscription.unsubscribe()
  } else if (typeof value.subscribe === 'function') {
    const subscription = value.subscribe(onNext, onError, onComplete)
    return () => subscription.unsubscribe()
  }

  // eslint-disable-next-line no-console
  console.error(
    `[withObservable] Value passed to withObservables doesn't appear to be observable:`,
    value,
  )
  throw new Error(
    `[withObservable] Value passed to withObservables doesn't appear to be observable. See console for details`,
  )
}

function identicalArrays<T, V: T[]>(left: V, right: V): boolean {
  if (left.length !== right.length) {
    return false
  }

  for (let i = 0, len = left.length; i < len; i += 1) {
    if (left[i] !== right[i]) {
      return false
    }
  }

  return true
}

function getTriggeringProps<PropsInput: { ... }>(
  props: PropsInput,
  propNames: TriggerProps<PropsInput>,
): any[] {
  if (!propNames) {
    return []
  }

  return propNames.map((name) => props[name])
}

const hasOwn = (obj: Object, key: string): boolean => {
  // $FlowFixMe
  return Object.prototype.hasOwnProperty.call(obj, key)
}

// TODO: This is probably not going to be 100% safe to use under React async mode
// Do more research
class WithObservablesComponent<AddedValues: any, PropsInput: { ... }> extends Component<
  *,
  {
    isFetching: boolean,
    values: $FlowFixMe<AddedValues>,
    error: ?Error,
    triggeredFromProps: any[],
  },
> {
  BaseComponent: React$ComponentType<Object>

  triggerProps: TriggerProps<PropsInput>

  getObservables: (PropsInput) => Observable<Object>

  _unsubscribe: ?Unsubscribe = null

  _prefetchTimeoutCanceled: boolean = false

  _exitedConstructor = false

  constructor(
    props: PropsInput,
    BaseComponent: React$ComponentType<Object>,
    getObservables: GetObservables<PropsInput, Object>,
    triggerProps: TriggerProps<PropsInput>,
  ): void {
    super(props)
    this.BaseComponent = BaseComponent
    this.triggerProps = triggerProps
    this.getObservables = getObservables
    this.state = {
      isFetching: true,
      values: {},
      error: null,
      triggeredFromProps: getTriggeringProps(props, triggerProps),
    }

    // The recommended React practice is to subscribe to async sources on `didMount`
    // Unfortunately, that's slow, because we have an unnecessary empty render even if we
    // can get first values before render.
    //
    // So we're subscribing in constructor, but that's dangerous. We have no guarantee that
    // the component will actually be mounted (and therefore that `willUnmount` will be called
    // to safely unsubscribe). So we're setting a safety timeout to avoid leaking memory.
    // If component is not mounted before timeout, we'll unsubscribe just to be sure.
    // (If component is mounted after all, just super slow, we'll subscribe again on didMount)
    this.subscribeWithoutSettingState(this.props)

    scheduleForCleanup(() => {
      if (!this._prefetchTimeoutCanceled) {
        // eslint-disable-next-line no-console
        console.warn(`[withObservables] Unsubscribing from source. Leaky component!`)
        this.unsubscribe()
      }
    })

    this._exitedConstructor = true
  }

  componentDidMount(): void {
    this.cancelPrefetchTimeout()

    if (!this._unsubscribe) {
      // eslint-disable-next-line no-console
      console.warn(
        `[withObservables] Component mounted but no subscription present. Slow component (timed out) or a bug! Re-subscribing...`,
      )

      const newTriggeringProps = getTriggeringProps(this.props, this.triggerProps)
      this.subscribe(this.props, newTriggeringProps)
    }
  }

  // eslint-disable-next-line
  UNSAFE_componentWillReceiveProps(nextProps: PropsInput): void {
    const { triggeredFromProps } = this.state
    const newTriggeringProps = getTriggeringProps(nextProps, this.triggerProps)

    if (!identicalArrays(triggeredFromProps, newTriggeringProps)) {
      this.subscribe(nextProps, newTriggeringProps)
    }
  }

  subscribe(props: PropsInput, triggeredFromProps: any[]): void {
    this.setState({
      isFetching: true,
      values: {},
      triggeredFromProps,
    })

    this.subscribeWithoutSettingState(props)
  }

  // NOTE: This is a hand-coded equivalent of Rx combineLatestObject
  subscribeWithoutSettingState(props: PropsInput): void {
    this.unsubscribe()

    const observablesObject = this.getObservables(props)

    let subscriptions: Unsubscribe[] = []
    let isUnsubscribed = false
    const unsubscribe = () => {
      isUnsubscribed = true
      subscriptions.forEach((_unsubscribe) => _unsubscribe())
      subscriptions = []
    }

    const values: { [string]: any } = {}
    let valueCount = 0

    const keys = Object.keys(observablesObject)
    const keyCount = keys.length
    keys.forEach((key) => {
      if (isUnsubscribed) {
        return
      }

      // $FlowFixMe
      const subscribable = observablesObject[key]
      subscriptions.push(
        subscribe(
          // $FlowFixMe
          subscribable,
          (value) => {
            // console.log(`new value for ${key}, all keys: ${keys}`)
            // Check if we have values for all observables; if yes - we can render; otherwise - only set value
            const isFirstEmission = !hasOwn(values, key)
            if (isFirstEmission) {
              valueCount += 1
            }

            values[key] = value

            const hasAllValues = valueCount === keyCount
            if (hasAllValues && !isUnsubscribed) {
              // console.log('okay, all values')
              this.withObservablesOnChange((values: any))
            }
          },
          (error) => {
            // Error in one observable should cause all observables to be unsubscribed from - the component is, in effect, broken now
            unsubscribe()
            this.withObservablesOnError(error)
          },
          () => {
            // TODO: Should we do anything on completion?
            // console.log(`completed for ${key}`)
          },
        ),
      )
    })

    if (process.env.NODE_ENV !== 'production') {
      const renderedTriggerProps = this.triggerProps ? this.triggerProps.join(',') : 'null'
      const renderedKeys = keys.join(', ')
      this.constructor.displayName = `withObservables[${renderedTriggerProps}] { ${renderedKeys} }`
    }

    this._unsubscribe = unsubscribe
  }

  // DO NOT rename (we want on call stack as debugging help)
  withObservablesOnChange(values: AddedValues): void {
    if (this._exitedConstructor) {
      this.setState({
        values,
        isFetching: false,
      })
    } else {
      // Source has called with first values synchronously while we're still in the
      // constructor. Here, `this.setState` does not work and we must mutate this.state
      // directly
      this.state.values = values
      this.state.isFetching = false
    }
  }

  // DO NOT rename (we want on call stack as debugging help)
  withObservablesOnError(error: Error): void {
    // console.error(`[withObservables] Error in Rx composition`, error)
    if (this._exitedConstructor) {
      this.setState({
        error,
        isFetching: false,
      })
    } else {
      this.state.error = error
      this.state.isFetching = false
    }
  }

  unsubscribe(): void {
    this._unsubscribe && this._unsubscribe()
    this.cancelPrefetchTimeout()
  }

  cancelPrefetchTimeout(): void {
    this._prefetchTimeoutCanceled = true
  }

  shouldComponentUpdate(nextProps: $FlowFixMe, nextState: $FlowFixMe): boolean {
    // If one of the triggering props change but we don't yet have first values from the new
    // observable, *don't* render anything!
    return !nextState.isFetching
  }

  componentWillUnmount(): void {
    this.unsubscribe()
  }

  render(): * {
    const { isFetching, values, error } = this.state

    if (isFetching) {
      return null
    } else if (error) {
      // rethrow error found in Rx composition as to unify withObservables errors with other React errors
      // the responsibility for handling errors is on the user (by using an Error Boundary)
      throw error
    } else {
      return createElement(this.BaseComponent, Object.assign({}, this.props, values))
    }
  }
}

/**
 *
 * Injects new props to a component with values from the passed Observables
 *
 * Every time one of the `triggerProps` changes, `getObservables()` is called
 * and the returned Observables are subscribed to.
 *
 * Every time one of the Observables emits a new value, the matching inner prop is updated.
 *
 * You can return multiple Observables in the function. You can also return arbitrary objects that have
 * an `observe()` function that returns an Observable.
 *
 * The inner component will not render until all supplied Observables return their first values.
 * If `triggerProps` change, renders will also be paused until the new Observables emit first values.
 *
 * If you only want to subscribe to Observables once (the Observables don't depend on outer props),
 * pass `null` to `triggerProps`.
 *
 * Errors are re-thrown in render(). Use React Error Boundary to catch them.
 *
 * Example use:
 * ```js
 *   withObservables(['task'], ({ task }) => ({
 *     task: task,
 *     comments: task.comments.observe()
 *   }))
 * ```
 */
const withObservables = <PropsInput: { ... }, ObservableProps: { ... }>(
  triggerProps: TriggerProps<PropsInput>,
  getObservables: GetObservables<PropsInput, ObservableProps>,
): WithObservables<PropsInput, ObservableProps> => {
  type AddedValues = Object

  return (BaseComponent) => {
    class ConcreteWithObservablesComponent extends WithObservablesComponent<
      AddedValues,
      PropsInput,
    > {
      constructor(props: PropsInput): void {
        super(props, BaseComponent, getObservables, triggerProps)
      }
    }
    if (process.env.NODE_ENV !== 'production') {
      const renderedTriggerProps = triggerProps ? triggerProps.join(',') : 'null'
      ConcreteWithObservablesComponent.displayName = `withObservables[${renderedTriggerProps}]`
    }

    return hoistNonReactStatics(ConcreteWithObservablesComponent, BaseComponent)
  }
}

export default withObservables
