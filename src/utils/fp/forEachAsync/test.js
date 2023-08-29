import forEachAsync from './index'

describe('forEachAsync', () => {
  it(`works correctly`, async () => {
    const delayed = (ms) =>
      new Promise((resolve) => {
        setTimeout(() => resolve(ms), ms)
      })

    const log = []
    await forEachAsync([3, 1, 2], async (el) => {
      await delayed(el)
      log.push(el * 2)
    })

    expect(log).toEqual([6, 2, 4])
  })
})
