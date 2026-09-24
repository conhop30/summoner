// Prints one hash over the shared contract: everything in contract/ (except this script) and
// everything in src/interchange/. Run it in Summoner and in Summoner Mobile; the two must print
// the same value. If they differ, the two apps no longer agree on the file format.
// Usage: node contract/hash.mjs
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const roots = ['contract', 'src/interchange']

function files(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

const hash = createHash('sha256')
for (const file of roots.flatMap(r => files(join(root, r))).map(f => relative(root, f).replaceAll('\\', '/')).sort()) {
  if (file === 'contract/hash.mjs') continue
  // Normalise line endings so a CRLF checkout hashes the same as LF.
  hash.update(file + '\n' + readFileSync(join(root, file), 'utf-8').replaceAll('\r\n', '\n') + '\n')
}
console.log(hash.digest('hex').slice(0, 16))
