// @flow

// Compressed records have this syntax:
// [
//   ['id', 'body', ...], // 0: column names
//   ['foo', 'bar', ...], // values matching column names
//   'id',                // only cached id
// ]
export default function decodeQueryResult(compressedRecords: any[]): any[] {
  const len = compressedRecords.length
  if (!len) {
    return []
  }
  const columnNames = compressedRecords[0]
  const columnsLen = columnNames.length

  const rawRecords = new Array(len - 1)
  let rawRecord, compressedRecord
  for (let i = 1; i < len; i++) {
    compressedRecord = compressedRecords[i]
    if (typeof compressedRecord === 'string') {
      rawRecord = compressedRecord
    } else {
      rawRecord = {}
      for (let j = 0; j < columnsLen; j++) {
        rawRecord[columnNames[j]] = compressedRecord[j]
      }
    }
    rawRecords[i - 1] = rawRecord
  }
  return rawRecords
}
