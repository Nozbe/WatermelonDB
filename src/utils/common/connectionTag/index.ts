export type ConnectionTag = number

let previousTag = 0

export default function connectionTag(): ConnectionTag {
  previousTag += 1
  return previousTag
}
