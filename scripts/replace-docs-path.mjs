import fs from 'node:fs'
import { promisify } from 'node:util'

const readFileAsync = promisify(fs.readFile)
const writeFileAsync = promisify(fs.writeFile)

function replaceAll(str, find, replace) {
  return str.replace(new RegExp(find, 'g'), replace)
}

const filePath = process.argv[2]

async function main() {
  const result = await readFileAsync(filePath, 'utf8')
  
  const newResult = replaceAll(result, 'docs-website/docs/docs/', '')
  
  await writeFileAsync(filePath, newResult, 'utf8')
}

main()