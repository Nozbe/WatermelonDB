// @flow

export default function notLikeToRegexp(likeQuery: string): RegExp {
  const regexp = `^((?!${likeQuery}).)*$`
    .replace(/%/g, '.*')
    .replace(/_/g, '.')

  return new RegExp(regexp, 'i')
}