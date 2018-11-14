import arrayDifference from './index'

describe('watermelondb/utils/fp/arrayDifference', () => {
  it('checks for differences between arrays', () => {
    expect(arrayDifference([], [])).toEqual({ added: [], removed: [] })
    expect(arrayDifference([null], [null])).toEqual({ added: [], removed: [] })
    expect(arrayDifference([null], [])).toEqual({ added: [], removed: [null] })
    expect(arrayDifference([], [null])).toEqual({ added: [null], removed: [] })
    expect(arrayDifference([true], [false])).toEqual({ added: [false], removed: [true] })
  })

  it('checks for differences between arrays of ints', () => {
    expect(arrayDifference([1], [])).toEqual({ added: [], removed: [1] })
    expect(arrayDifference([1, 2], [])).toEqual({ added: [], removed: [1, 2] })
    expect(arrayDifference([], [1])).toEqual({ added: [1], removed: [] })
    expect(arrayDifference([], [1, 2])).toEqual({ added: [1, 2], removed: [] })
    expect(arrayDifference([1, 2], [2, 3])).toEqual({ added: [3], removed: [1] })
    expect(arrayDifference([1, 2, 3], [1, 2, 3])).toEqual({ added: [], removed: [] })
    expect(arrayDifference([1, 2, 3], [4, 5, 6])).toEqual({ added: [4, 5, 6], removed: [1, 2, 3] })
  })

  it('checks for differences between arrays of strings', () => {
    expect(arrayDifference([''], [''])).toEqual({ added: [], removed: [] })
    expect(arrayDifference([''], [])).toEqual({ added: [], removed: [''] })
    expect(arrayDifference([], [''])).toEqual({ added: [''], removed: [] })
    expect(arrayDifference(['string'], [])).toEqual({ added: [], removed: ['string'] })
    expect(arrayDifference([], ['string'])).toEqual({ added: ['string'], removed: [] })
  })

  it('checks for differences between arrays of objects', () => {
    expect(arrayDifference([{}], [{}])).toEqual({ added: [{}], removed: [{}] })
    expect(arrayDifference([{}], [])).toEqual({ added: [], removed: [{}] })
    expect(arrayDifference([], [{}])).toEqual({ added: [{}], removed: [] })
    expect(
      arrayDifference(
        [
          {
            name: 'Kornel',
            isNasty: true,
          },
        ],
        [
          {
            name: 'Kornel',
            isNasty: true,
          },
        ],
      ),
    ).toEqual({
      added: [
        {
          name: 'Kornel',
          isNasty: true,
        },
      ],
      removed: [
        {
          name: 'Kornel',
          isNasty: true,
        },
      ],
    })

    expect(
      arrayDifference(
        [
          {
            name: 'Kornel',
            isNasty: true,
          },
        ],
        [
          {
            name: 'Kornel',
            isNasty: false,
          },
        ],
      ),
    ).toEqual({
      added: [
        {
          name: 'Kornel',
          isNasty: false,
        },
      ],
      removed: [
        {
          name: 'Kornel',
          isNasty: true,
        },
      ],
    })

    expect(
      arrayDifference(
        [
          {
            name: 'Kornel',
            isNasty: true,
          },
        ],
        [],
      ),
    ).toEqual({
      added: [],
      removed: [
        {
          name: 'Kornel',
          isNasty: true,
        },
      ],
    })

    expect(
      arrayDifference(
        [],
        [
          {
            name: 'Kornel',
            isNasty: false,
          },
        ],
      ),
    ).toEqual({
      added: [
        {
          name: 'Kornel',
          isNasty: false,
        },
      ],
      removed: [],
    })

    expect(
      arrayDifference(
        [
          {
            name: 'Kornel',
            isNasty: true,
          },
        ],
        [
          {
            name: 'Kornel',
            isNasty: false,
          },
        ],
      ),
    ).toEqual({
      added: [
        {
          name: 'Kornel',
          isNasty: false,
        },
      ],
      removed: [
        {
          name: 'Kornel',
          isNasty: true,
        },
      ],
    })
  })
})
