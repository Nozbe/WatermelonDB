// @flow
import { useState, useEffect, useMemo } from 'react'
import { BehaviorSubject } from 'rxjs/BehaviorSubject'
import type { Observable } from 'rxjs/Observable'

export function useObservable(observable$: Observable, initialState, inputs): any {
  const [state, setState] = useState(typeof initialState !== 'undefined' ? initialState : null)

  const { state$, inputs$ } = useMemo(() => {
    const stateSubject$ = new BehaviorSubject(initialState)
    const inputSubject$ = new BehaviorSubject(inputs)
    return {
      state$: stateSubject$,
      inputs$: inputSubject$,
    }
  }, [])

  useEffect(() => {
    inputs$.next(inputs)
  }, inputs || [])

  useEffect(() => {
    const subscription = observable$.subscribe(value => {
      state$.next(value)
      setState(value)
    })
    return () => {
      subscription.unsubscribe()
      inputs$.complete()
      state$.complete()
    }
  }, [])

  return state
}
