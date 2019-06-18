import randomId, { setGenerator } from './index'

describe('randomId', () => {
  it('generates a random string', () => {
    const id1 = randomId()
    expect(id1.length).toBe(16)

    const id2 = randomId()
    expect(id2).not.toBe(id1)
  })

  it('allows to override the generator function', () => {
    const generator = () => {
      return new Date()
        .getTime()
        .toString()
        .substr(1, 4)
    }

    setGenerator(generator)

    expect(randomId().length).toBe(4)

    const invalidGenerator = () => 5

    expect(() => setGenerator(invalidGenerator)).toThrow()
  })
})
