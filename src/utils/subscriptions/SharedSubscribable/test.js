import SharedSubscribable from './index'

describe('SharedSubscribable', () => {
  it('allows a subscription to be passed through', () => {
    let emitValue = null
    const sourceUnsubscribe = jest.fn()
    const source = jest.fn(subscriber => {
      emitValue = subscriber
      return sourceUnsubscribe
    })

    const shared = new SharedSubscribable(source)
    expect(source).toHaveBeenCalledTimes(0)
    expect(emitValue).toBe(null)
    expect(sourceUnsubscribe).toHaveBeenCalledTimes(0)

    const subscriber = jest.fn()
    const unsubscribe = shared.subscribe(subscriber)

    expect(source).toHaveBeenCalledTimes(1)
    expect(emitValue).not.toBe(null)
    expect(subscriber).toHaveBeenCalledTimes(0)

    emitValue('foo')
    expect(subscriber).toHaveBeenCalledTimes(1)
    expect(subscriber).toHaveBeenLastCalledWith('foo')

    emitValue('bar')
    expect(subscriber).toHaveBeenCalledTimes(2)
    expect(subscriber).toHaveBeenLastCalledWith('bar')

    expect(sourceUnsubscribe).toHaveBeenCalledTimes(0)
    unsubscribe()

    expect(source).toHaveBeenCalledTimes(1)
    expect(sourceUnsubscribe).toHaveBeenCalledTimes(1)
    expect(subscriber).toHaveBeenCalledTimes(2)
  })
  it('can multicast to multiple subscribers', async () => {
    let emitValue = null
    const sourceUnsubscribe = jest.fn()
    const source = jest.fn(subscriber => {
      emitValue = subscriber
      return sourceUnsubscribe
    })

    const shared = new SharedSubscribable(source)

    const subscriber1 = jest.fn()
    const unsubscribe1 = shared.subscribe(subscriber1)

    const subscriber2 = jest.fn()
    const unsubscribe2 = shared.subscribe(subscriber2)

    const subscriber3 = jest.fn()
    const unsubscribe3 = shared.subscribe(subscriber3)

    emitValue('foo')
    expect(subscriber1).toHaveBeenCalledTimes(1)
    expect(subscriber2).toHaveBeenCalledTimes(1)
    expect(subscriber3).toHaveBeenCalledTimes(1)
    expect(subscriber1).toHaveBeenLastCalledWith('foo')
    expect(subscriber2).toHaveBeenLastCalledWith('foo')

    unsubscribe2()

    emitValue('bar')
    expect(subscriber1).toHaveBeenCalledTimes(2)
    expect(subscriber2).toHaveBeenCalledTimes(1)
    expect(subscriber3).toHaveBeenCalledTimes(2)
    expect(subscriber3).toHaveBeenLastCalledWith('bar')

    unsubscribe3()
    emitValue('baz')
    expect(subscriber1).toHaveBeenCalledTimes(3)
    expect(subscriber2).toHaveBeenCalledTimes(1)
    expect(subscriber3).toHaveBeenCalledTimes(2)

    expect(sourceUnsubscribe).toHaveBeenCalledTimes(0)
    unsubscribe1()
    expect(sourceUnsubscribe).toHaveBeenCalledTimes(1)

    expect(source).toHaveBeenCalledTimes(1)
  })
  it('reemits last value to new subscribers, if any', () => {
    let emitValue = null
    const sourceUnsubscribe = jest.fn()
    const source = jest.fn(subscriber => {
      emitValue = subscriber
      return sourceUnsubscribe
    })

    const shared = new SharedSubscribable(source)

    const subscriber1 = jest.fn()
    const unsubscribe1 = shared.subscribe(subscriber1)

    emitValue('foo')
    expect(subscriber1).toHaveBeenLastCalledWith('foo')

    const subscriber2 = jest.fn()
    const unsubscribe2 = shared.subscribe(subscriber2)

    expect(subscriber2).toHaveBeenCalledTimes(1)
    expect(subscriber2).toHaveBeenLastCalledWith('foo')

    emitValue('bar')

    const subscriber3 = jest.fn()
    const unsubscribe3 = shared.subscribe(subscriber3)

    expect(subscriber3).toHaveBeenCalledTimes(1)
    expect(subscriber3).toHaveBeenLastCalledWith('bar')

    unsubscribe1()
    unsubscribe2()
    unsubscribe3()
    expect(subscriber1).toHaveBeenCalledTimes(2)
    expect(subscriber2).toHaveBeenCalledTimes(2)
    expect(subscriber3).toHaveBeenCalledTimes(1)
    expect(sourceUnsubscribe).toHaveBeenCalledTimes(1)
  })
  it('source can notify subscriber synchronously with subscription', () => {
    let emitValue = null
    const sourceUnsubscribe = jest.fn()
    const source = jest.fn(subscriber => {
      subscriber(10)
      emitValue = subscriber
      return sourceUnsubscribe
    })

    const shared = new SharedSubscribable(source)

    const subscriber1 = jest.fn()
    const unsubscribe1 = shared.subscribe(subscriber1)
    expect(subscriber1).toHaveBeenCalledTimes(1)
    expect(subscriber1).toHaveBeenLastCalledWith(10)

    const subscriber2 = jest.fn()
    const unsubscribe2 = shared.subscribe(subscriber2)
    expect(subscriber2).toHaveBeenCalledTimes(1)

    emitValue(20)

    expect(subscriber2).toHaveBeenCalledTimes(2)
    expect(subscriber2).toHaveBeenCalledTimes(2)
    expect(subscriber2).toHaveBeenLastCalledWith(20)

    unsubscribe1()
    unsubscribe2()
    expect(sourceUnsubscribe).toHaveBeenCalledTimes(1)
  })
  it('can resubscribe to source', () => {
    let emitValue = null
    const sourceUnsubscribe = jest.fn()
    const source = jest.fn(subscriber => {
      emitValue = subscriber
      return sourceUnsubscribe
    })

    const shared = new SharedSubscribable(source)

    const subscriber1 = jest.fn()
    const unsubscribe1 = shared.subscribe(subscriber1)

    emitValue(20)

    const subscriber2 = jest.fn()
    const unsubscribe2 = shared.subscribe(subscriber2)

    unsubscribe1()
    unsubscribe2()
    expect(source).toHaveBeenCalledTimes(1)
    expect(sourceUnsubscribe).toHaveBeenCalledTimes(1)

    const subscriber3 = jest.fn()
    const unsubscribe3 = shared.subscribe(subscriber3)

    expect(source).toHaveBeenCalledTimes(2)
    expect(subscriber3).toHaveBeenCalledTimes(0)

    emitValue('heyey')
    expect(subscriber3).toHaveBeenCalledTimes(1)
    expect(subscriber3).toHaveBeenLastCalledWith('heyey')

    unsubscribe3()
    expect(sourceUnsubscribe).toHaveBeenCalledTimes(2)
  })
  it('too many calls to unsubscribe are safe', () => {
    const sourceUnsubscribe = jest.fn()
    const source = jest.fn(_subscriber => {
      return sourceUnsubscribe
    })

    const shared = new SharedSubscribable(source)
    const unsubscribe = shared.subscribe(() => {})

    expect(sourceUnsubscribe).toHaveBeenCalledTimes(0)
    unsubscribe()
    expect(sourceUnsubscribe).toHaveBeenCalledTimes(1)
    unsubscribe()
    expect(sourceUnsubscribe).toHaveBeenCalledTimes(1)
  })
})
