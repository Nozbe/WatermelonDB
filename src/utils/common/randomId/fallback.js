// @flow

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

const randomId = (): string => {
  let id = ''
  let v = 0
  for (let i = 0; i < 16; i += 1) {
    v = Math.floor(Math.random() * 62)
    id += alphabet[v % 62]
  }

  return id
}

export default randomId
