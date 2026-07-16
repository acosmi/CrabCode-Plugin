import { createServer, type Server } from 'node:http'
import { readFile, realpath, stat } from 'node:fs/promises'
import { extname, resolve } from 'node:path'

export type TestArtifactServer = {
  server: Server
  port: number
  stop: () => Promise<void>
}

export async function serveArtifactRoot(root: string): Promise<TestArtifactServer> {
  const artifactRoot = await realpath(resolve(root))
  const server = createServer((request, response) => {
    void (async () => {
      let pathname: string
      try {
        pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname)
      } catch {
        response.writeHead(400).end('Bad path')
        return
      }
      const segments = pathname.split('/').filter(Boolean)
      if (segments.some((segment) => segment === '.' || segment === '..' || segment.includes('\\'))) {
        response.writeHead(403).end('Forbidden')
        return
      }
      const candidate = resolve(artifactRoot, ...segments)
      if (candidate !== artifactRoot && !candidate.startsWith(`${artifactRoot}/`)) {
        response.writeHead(403).end('Forbidden')
        return
      }
      let actualPath: string
      try {
        actualPath = await realpath(candidate)
        if (actualPath !== artifactRoot && !actualPath.startsWith(`${artifactRoot}/`)) throw new Error('Outside artifact root')
        if (!(await stat(actualPath)).isFile()) throw new Error('Not a file')
      } catch {
        response.writeHead(404).end('Not found')
        return
      }
      const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' }
      const bytes = await readFile(actualPath)
      response.writeHead(200, { 'Content-Type': types[extname(actualPath).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-store' })
      response.end(bytes)
    })().catch((error) => response.writeHead(500).end(error instanceof Error ? error.message : String(error)))
  })
  await new Promise<void>((resolveListening, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolveListening()
    })
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Test server has no TCP port.')
  return {
    server,
    port: address.port,
    stop: async () => await new Promise<void>((resolveStopped, reject) => server.close((error) => error ? reject(error) : resolveStopped())),
  }
}

export async function settlePage(): Promise<void> {
  await document.fonts.ready
  const images = Array.from(document.images)
  for (const image of images) image.loading = 'eager'
  await Promise.all(images.map(async (image) => {
    if (!image.complete) {
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error(`Image load timed out: ${image.currentSrc || image.src}`)), 10_000)
        image.addEventListener('load', () => { window.clearTimeout(timeout); resolve() }, { once: true })
        image.addEventListener('error', () => { window.clearTimeout(timeout); reject(new Error(`Image failed to load: ${image.currentSrc || image.src}`)) }, { once: true })
      })
    }
    if (!image.naturalWidth || !image.naturalHeight) throw new Error(`Image has no decodable pixels: ${image.currentSrc || image.src}`)
    await image.decode()
  }))
}
