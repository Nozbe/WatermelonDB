// @flow

export default function likeToRegexp(likeQuery: string): RegExp {
  // Escape regex special characters so the pattern is matched literally — the
  // same way the SQLite adapter treats a LIKE pattern. `%` and `_` are
  // intentionally not escaped here so they remain LIKE wildcards below.
  const escaped = likeQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regexp = `^${escaped}$`.replace(/%/g, '.*').replace(/_/g, '.')
  return new RegExp(regexp, 'is')
}
