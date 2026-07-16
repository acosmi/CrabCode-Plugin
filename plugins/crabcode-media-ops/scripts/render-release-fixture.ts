import { resolve } from 'node:path'
import { artifactRef } from '../src/qa/artifacts.ts'
import { writeReleaseFixture } from '../src/qa/release-fixture.ts'

function outputArgument(argv: string[]): string {
  const index = argv.indexOf('--output')
  if (index === -1) return resolve('test-results', 'release-fixture')
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) throw new Error('--output requires a directory path.')
  return resolve(value)
}

const outputRoot = outputArgument(process.argv.slice(2))
const rendered = await writeReleaseFixture(outputRoot)
const refs = await Promise.all([
  artifactRef(rendered.artifactRoot, resolve(rendered.artifactRoot, 'article.html')),
  artifactRef(rendered.artifactRoot, resolve(rendered.artifactRoot, 'article.md')),
  artifactRef(rendered.artifactRoot, resolve(rendered.artifactRoot, 'wechat-richtext.html')),
  artifactRef(rendered.artifactRoot, rendered.manifestPath),
])

console.log(JSON.stringify({
  status: 'rendered',
  artifactRoot: rendered.artifactRoot,
  htmlRelativePath: rendered.htmlRelativePath,
  files: refs,
}, null, 2))
