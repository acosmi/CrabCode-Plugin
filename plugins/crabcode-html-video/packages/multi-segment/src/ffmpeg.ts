import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

export interface FfmpegRunResult {
  code: number
  stdout: string
  stderr: string
}

export interface ProcessRunOptions {
  cwd?: string
  timeoutMs?: number
  signal?: AbortSignal
}

/**
 * Resolve ffmpeg binary.
 * Priority (matches hyperframes engine contract + our domestic mirror wiring):
 * 1. HYPERFRAMES_FFMPEG_PATH / CRABCODE_FFMPEG_PATH
 * 2. ffmpeg-static (if present and file exists)
 * 3. system `ffmpeg` on PATH — only if it actually runs (broken brew links are skipped)
 */
export function resolveFfmpegPath(): string {
  const env =
    process.env.HYPERFRAMES_FFMPEG_PATH ||
    process.env.CRABCODE_FFMPEG_PATH ||
    process.env.FFMPEG_PATH
  if (env && existsSync(env) && canRunBinary(env)) return env

  const fromStatic = resolvePackageBinary('ffmpeg-static')
  if (fromStatic) return fromStatic

  // Prefer a runnable system binary; skip broken dylib links.
  if (canRunBinary('ffmpeg')) return 'ffmpeg'
  // Last resort: still return name so error messages mention it
  return fromStatic || 'ffmpeg'
}

export function resolveFfprobePath(): string {
  const env = process.env.HYPERFRAMES_FFPROBE_PATH || process.env.CRABCODE_FFPROBE_PATH || process.env.FFPROBE_PATH
  if (env && existsSync(env) && canRunBinary(env)) return env

  const fromStatic = resolvePackageBinary('ffprobe-static')
  if (fromStatic) return fromStatic

  // Prefer sibling of ffmpeg when env points at a full path
  const ffmpeg = resolveFfmpegPath()
  if (ffmpeg !== 'ffmpeg' && existsSync(ffmpeg)) {
    const sibling = ffmpeg.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1')
    if (sibling !== ffmpeg && existsSync(sibling) && canRunBinary(sibling)) return sibling
  }
  if (canRunBinary('ffprobe')) return 'ffprobe'
  // Marker for probeDurationSec to fall back to ffmpeg -i parsing
  return ''
}

function resolvePackageBinary(pkg: string): string | null {
  try {
    const { createRequire } = require('node:module') as typeof import('node:module')
    const bases = [import.meta.url, join(process.cwd(), 'package.json')]
    for (const base of bases) {
      try {
        const req = createRequire(base)
        const mod = req(pkg) as string | { path?: string; default?: string } | null
        const p = typeof mod === 'string' ? mod : mod?.path || mod?.default
        if (p && existsSync(p) && canRunBinary(p)) return p
      } catch {
        // try next base
      }
    }
  } catch {
    // not installed
  }
  return null
}

function canRunBinary(bin: string): boolean {
  try {
    const { spawnSync } = require('node:child_process') as typeof import('node:child_process')
    const r = spawnSync(bin, ['-version'], { encoding: 'utf-8', timeout: 5000 })
    return r.status === 0
  } catch {
    return false
  }
}

export async function runFfmpeg(args: string[], opts?: ProcessRunOptions): Promise<FfmpegRunResult> {
  const bin = resolveFfmpegPath()
  return runProcess(bin, args, opts)
}

export async function runFfprobe(args: string[], opts?: ProcessRunOptions): Promise<FfmpegRunResult> {
  const bin = resolveFfprobePath()
  return runProcess(bin, args, opts)
}

function runProcess(
  bin: string,
  args: string[],
  opts?: ProcessRunOptions,
): Promise<FfmpegRunResult> {
  if (opts?.signal?.aborted) return Promise.reject(opts.signal.reason ?? new Error('process cancelled'))
  return new Promise((resolvePromise, reject) => {
    const child = spawn(bin, args, {
      cwd: opts?.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const finishReject = (error: unknown) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }
    const onAbort = () => {
      child.kill('SIGKILL')
      finishReject(opts?.signal?.reason ?? new Error(`${bin} cancelled`))
    }
    const cleanup = () => {
      if (timer) clearTimeout(timer)
      opts?.signal?.removeEventListener('abort', onAbort)
    }
    timer =
      opts?.timeoutMs && opts.timeoutMs > 0
        ? setTimeout(() => {
            child.kill('SIGKILL')
            finishReject(new Error(`${bin} timed out after ${opts.timeoutMs}ms`))
          }, opts.timeoutMs)
        : null
    opts?.signal?.addEventListener('abort', onAbort, { once: true })

    child.stdout.on('data', (d) => {
      if (stdout.length < 2_000_000) stdout += String(d)
    })
    child.stderr.on('data', (d) => {
      if (stderr.length < 2_000_000) stderr += String(d)
    })
    child.on('error', (err) => {
      finishReject(err)
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      cleanup()
      resolvePromise({ code: code ?? 1, stdout, stderr })
    })
  })
}

export async function probeDurationSec(filePath: string, opts?: ProcessRunOptions): Promise<number> {
  const probe = resolveFfprobePath()
  if (probe) {
    const r = await runProcess(probe, [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ], opts)
    if (r.code === 0) {
      const n = parseFloat(r.stdout.trim())
      if (isFinite(n) && n > 0) return n
    }
  }

  // Fallback: parse `ffmpeg -i` Duration line (works when only ffmpeg-static is present)
  const r = await runFfmpeg(['-i', filePath], { ...opts, timeoutMs: opts?.timeoutMs ?? 30_000 })
  const m = (r.stderr || r.stdout).match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
  if (!m) {
    throw new Error(`probeDurationSec failed for ${filePath}: ${r.stderr || r.stdout}`)
  }
  const hours = parseInt(m[1]!, 10)
  const mins = parseInt(m[2]!, 10)
  const secs = parseFloat(m[3]!)
  const total = hours * 3600 + mins * 60 + secs
  if (!isFinite(total) || total <= 0) {
    throw new Error(`invalid duration parsed for ${filePath}`)
  }
  return total
}

/**
 * Concat demuxer (-c copy) when all segments share compatible params.
 * Falls back to re-encode if copy fails.
 */
export async function concatVideos(
  segmentPaths: string[],
  outputPath: string,
  opts?: ProcessRunOptions,
): Promise<void> {
  if (segmentPaths.length === 0) throw new Error('concatVideos: no segments')
  if (segmentPaths.length === 1) {
    // Single segment: just remux/copy to destination
    const r = await runFfmpeg(['-y', '-i', segmentPaths[0]!, '-c', 'copy', '-movflags', '+faststart', outputPath], {
      ...opts,
      timeoutMs: opts?.timeoutMs ?? 120_000,
    })
    if (r.code !== 0) {
      // re-encode fallback
      const r2 = await runFfmpeg(
        [
          '-y',
          '-i',
          segmentPaths[0]!,
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-movflags',
          '+faststart',
          outputPath,
        ],
        { ...opts, timeoutMs: opts?.timeoutMs ?? 300_000 },
      )
      if (r2.code !== 0) throw new Error(`ffmpeg single-copy failed: ${r2.stderr}`)
    }
    return
  }

  mkdirSync(dirname(outputPath), { recursive: true })
  const listFile = join(tmpdir(), `crab-concat-${randomUUID()}.txt`)
  const body = segmentPaths.map((p) => `file '${resolve(p).replace(/'/g, "'\\''")}'`).join('\n') + '\n'
  writeFileSync(listFile, body, { encoding: 'utf-8', flag: 'wx', mode: 0o600 })

  try {
    const copy = await runFfmpeg(
      ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-movflags', '+faststart', outputPath],
      { ...opts, timeoutMs: opts?.timeoutMs ?? 300_000 },
    )
    if (copy.code === 0) return

    // Re-encode path for mismatched GOPs/codecs
    const re = await runFfmpeg(
      [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listFile,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-preset',
        'veryfast',
        '-crf',
        '18',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-movflags',
        '+faststart',
        outputPath,
      ],
      { ...opts, timeoutMs: opts?.timeoutMs ?? 600_000 },
    )
    if (re.code !== 0) {
      throw new Error(`ffmpeg concat failed (copy+reencode): ${re.stderr || copy.stderr}`)
    }
  } finally {
    rmSync(listFile, { force: true })
  }
}

/**
 * Mux a silent/concat video with an optional audio file (or generate silence).
 */
export async function muxAudio(
  videoPath: string,
  audioPath: string | null,
  outputPath: string,
  opts?: ProcessRunOptions,
): Promise<void> {
  mkdirSync(dirname(outputPath), { recursive: true })
  if (!audioPath) {
    // Ensure faststart even without audio
    const r = await runFfmpeg(['-y', '-i', videoPath, '-c', 'copy', '-movflags', '+faststart', outputPath], {
      ...opts,
      timeoutMs: opts?.timeoutMs ?? 120_000,
    })
    if (r.code !== 0) throw new Error(`ffmpeg remux failed: ${r.stderr}`)
    return
  }

  const videoDurationSec = await probeDurationSec(videoPath, opts)
  const r = await runFfmpeg(
    [
      '-y',
      '-i',
      videoPath,
      '-i',
      audioPath,
      '-filter_complex',
      `[1:a:0]aresample=async=1:first_pts=0,apad,atrim=duration=${videoDurationSec}[a]`,
      '-map',
      '0:v:0',
      '-map',
      '[a]',
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-t',
      String(videoDurationSec),
      '-movflags',
      '+faststart',
      outputPath,
    ],
    { ...opts, timeoutMs: opts?.timeoutMs ?? 300_000 },
  )
  if (r.code !== 0) {
    throw new Error(`ffmpeg mux audio failed: ${r.stderr}`)
  }
  const outputDurationSec = await probeDurationSec(outputPath, opts)
  if (Math.abs(outputDurationSec - videoDurationSec) > 0.25) {
    rmSync(outputPath, { force: true })
    throw new Error(
      `audio mux changed video duration from ${videoDurationSec.toFixed(3)}s to ${outputDurationSec.toFixed(3)}s`,
    )
  }
}

/**
 * Generate a short silent AAC audio track for smoke tests.
 */
export async function generateSilentAudio(outputPath: string, durationSec: number, sampleRate = 44100): Promise<void> {
  mkdirSync(dirname(outputPath), { recursive: true })
  const r = await runFfmpeg(
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `anullsrc=r=${sampleRate}:cl=stereo`,
      '-t',
      String(durationSec),
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      outputPath,
    ],
    { timeoutMs: 60_000 },
  )
  if (r.code !== 0) throw new Error(`generateSilentAudio failed: ${r.stderr}`)
}

/**
 * Generate a short sine tone for audio-presence smoke tests.
 */
export async function generateToneAudio(
  outputPath: string,
  durationSec: number,
  freqHz = 440,
  sampleRate = 44100,
): Promise<void> {
  mkdirSync(dirname(outputPath), { recursive: true })
  const r = await runFfmpeg(
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=${freqHz}:sample_rate=${sampleRate}`,
      '-t',
      String(durationSec),
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      outputPath,
    ],
    { timeoutMs: 60_000 },
  )
  if (r.code !== 0) throw new Error(`generateToneAudio failed: ${r.stderr}`)
}
