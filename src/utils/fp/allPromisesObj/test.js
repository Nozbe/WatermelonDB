import allPromisesObj from './index'

describe('allPromisesObj', () => {
  it(`works correctly`, async () => {
    const delayed = (ms) =>
      new Promise((resolve) => {
        setTimeout(() => resolve(ms), ms)
      })

    expect(
      await allPromisesObj({
        a: delayed(2),
        b: delayed(1),
        c: delayed(3),
      }),
    ).toEqual({
      a: 2,
      b: 1,
      c: 3,
    })
  })
})
