import randomId from './index'

describe('randomId', () => {
  it('generates a random string', () => {
    const id1 = randomId()
    expect(id1.length).toBe(16)

    const id2 = randomId()
    expect(id2).not.toBe(id1)
  })
})
