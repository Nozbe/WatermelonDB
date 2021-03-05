// @flow

export default function groupBy<Val, Key>(predicate: Val => Key): ((list: Val[]) => { [Key]: Val[] }) {
  return list => {
    const groupped: { [Key]: Val[] } = {}
    let item; let key; let group
    for (let i = 0, len = list.length; i < len; i++) {
      item = list[i]
      key = predicate(item)
      group = groupped[key]
      if (group) {
        group.push(item)
      } else {
        groupped[key] = [item]
      }
    }
    return groupped
  }
}
