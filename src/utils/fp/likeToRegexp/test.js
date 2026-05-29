import likeToRegexp from './index'

describe('likeToRegexp', () => {
  it('treats % and _ as wildcards', () => {
    expect(likeToRegexp('100%').test('100abc')).toBe(true)
    expect(likeToRegexp('a_b').test('axb')).toBe(true)
    expect(likeToRegexp('a_b').test('ab')).toBe(false)
  })

  it('matches newlines (dotall) and is case-insensitive', () => {
    expect(likeToRegexp('a%b').test('a\nb')).toBe(true)
    expect(likeToRegexp('a_b').test('a\nb')).toBe(true)
    expect(likeToRegexp('ABC').test('abc')).toBe(true)
  })

  it('treats regex special characters as literals (matching the SQLite adapter)', () => {
    // `.` is a literal dot, not "any character"
    expect(likeToRegexp('a.b').test('a.b')).toBe(true)
    expect(likeToRegexp('a.b').test('axb')).toBe(false)
    expect(likeToRegexp('%.pdf').test('doc.pdf')).toBe(true)
    expect(likeToRegexp('%.pdf').test('docXpdf')).toBe(false)
    // `+` is a literal, not a quantifier
    expect(likeToRegexp('c+').test('c+')).toBe(true)
    expect(likeToRegexp('c+').test('cccc')).toBe(false)
  })

  it('does not crash on unbalanced regex metacharacters', () => {
    expect(() => likeToRegexp('a(b')).not.toThrow()
    expect(likeToRegexp('a(b').test('a(b')).toBe(true)
    expect(() => likeToRegexp('a[b')).not.toThrow()
    expect(likeToRegexp('a[b').test('a[b')).toBe(true)
  })
})
