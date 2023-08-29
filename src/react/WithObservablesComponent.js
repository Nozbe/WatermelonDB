// @flow

import { useRef } from 'react'
import type { Observable } from 'rxjs'

import identicalArrays from '../utils/fp/identicalArrays'

import withObservables, { type ExtractTypeFromObservable } from './withObservables'
import compose from './compose'
import withHooks from './withHooks'
import { type HOC } from './helpers'

type ExportProps<ObservableProps> = $Exact<{
  resetOn: any[],
  observables: ObservableProps,
  children: ($ObjMap<ObservableProps, ExtractTypeFromObservable>) => React$Node,
}>

type InitialProps = $Exact<{
  resetOn: any[],
  observables: { [string]: Observable<any> },
  children: ({ [string]: any }) => React$Node,
}>

const WithObservables = (props: InitialProps) => {
  const { children } = props

  return children(props)
}

const enhance: HOC<any, InitialProps> = compose(
  withHooks(({ resetOn, observables }) => {
    const triggeringProps = useRef(resetOn)
    if (!identicalArrays(triggeringProps.current, resetOn)) {
      triggeringProps.current = resetOn
    }

    if (process.env.NODE_ENV !== 'production') {
      const keys = Object.keys(observables)
      if (
        keys.includes('resetOn') ||
        keys.includes('observables') ||
        keys.includes('children') ||
        keys.includes('__triggeringProps')
      ) {
        throw new Error(`Do not use reserved keys in WithObservables's observables props`)
      }
    }

    return {
      __triggeringProps: triggeringProps.current,
    }
  }),
  withObservables(['__triggeringProps'], ({ observables }) => (observables: any)),
)

export default ((enhance(WithObservables): any): <T>(ExportProps<T>) => React$Node)
