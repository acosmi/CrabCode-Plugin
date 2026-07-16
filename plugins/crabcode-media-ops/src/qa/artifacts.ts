import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { extname, relative, resolve, sep } from 'node:path'
import type { QaArtifactRef } from './types.ts'

const MEDIA_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.md': 'text/markdown; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
}

export function sha256Bytes(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function artifactRef(artifactRoot: string, path: string): Promise<QaArtifactRef> {
  const root = resolve(artifactRoot)
  const absolutePath = resolve(path)
  const relativePath = relative(root, absolutePath)
  if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${sep}`) || relativePath.startsWith(sep)) {
    throw new Error(`QA artifact path escapes artifactRoot: ${absolutePath}`)
  }
  const bytes = await readFile(absolutePath)
  return {
    relativePath: relativePath.split(sep).join('/'),
    absolutePath,
    mediaType: MEDIA_TYPES[extname(absolutePath).toLowerCase()] ?? 'application/octet-stream',
    byteSize: bytes.byteLength,
    sha256: sha256Bytes(bytes),
  }
}
