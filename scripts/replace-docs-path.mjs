import fs from 'node:fs'
import { promisify } from 'node:util'

const readFileAsync = promisify(fs.readFile)
const writeFileAsync = promisify(fs.writeFile)

const filePath = process.argv[2]

async function main() {
  const result = await readFileAsync(filePath, 'utf8')

  const newResult = result.replaceAll('docs-website/docs/docs/', '').replaceAll('<', '&lt;')

  await writeFileAsync(filePath, newResult, 'utf8')
}

main()
