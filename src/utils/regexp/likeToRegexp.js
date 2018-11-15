export default likeQuery => {
  const regexp = `^${likeQuery}$`
    .replace(/%/g, '.*')
    .replace(/_/g, '.')

  return new RegExp(regexp, 'i')
}
