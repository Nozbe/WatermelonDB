import lazy from './index'

describe('decorators/lazy', () => {
  it('calculates value on first evaluation only', () => {
    let fooMakesCounter = 0
    const makeFoo = () => {
      fooMakesCounter += 1
      return { id: fooMakesCounter }
    }

    class X {
      @lazy
      foo = makeFoo()
    }
    const x = new X()

    // No evaluation on construction
    expect(fooMakesCounter).toBe(0)

    // Check first evaluation
    const { foo } = x
    expect(foo).toEqual({ id: 1 })
    expect(fooMakesCounter).toBe(1)

    // No subsequent evaluations
    expect(x.foo).toBe(foo)
    expect(x.foo).toEqual({ id: 1 })
    expect(fooMakesCounter).toBe(1)

    // Try another object
    const x2 = new X()
    expect(fooMakesCounter).toBe(1)
    expect(x2.foo).toEqual({ id: 2 })
    expect(x2.foo).toEqual({ id: 2 })
    expect(fooMakesCounter).toBe(2)
  })
})
