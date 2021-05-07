import randomId, { setGenerator } from './index'

describe('randomId', () => {
  it('generates a random string', () => {
    const id1 = randomId()
    expect(id1.length).toBe(16)

    const id2 = randomId()
    expect(id2).not.toBe(id1)
  })
  it('always generates a valid id', () => {
    const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz'
    for (let i = 0; i < 250; i += 1) {
      const id = randomId()
      expect(id.length).toBe(16)
      expect(id.split('').every((char) => alphabet.includes(char))).toBe(true)
    }
  })

  it('allows to override the generator function', () => {
    const generator = () => {
      return new Date().getTime().toString().substr(1, 4)
    }

    setGenerator(generator)

    expect(randomId().length).toBe(4)

    const invalidGenerator = () => 5

    expect(() => setGenerator(invalidGenerator)).toThrow()
  })
})
