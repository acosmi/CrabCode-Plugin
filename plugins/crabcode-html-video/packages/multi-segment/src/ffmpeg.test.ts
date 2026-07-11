import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  generateToneAudio,
  muxAudio,
  probeDurationSec,
  resolveFfmpegPath,
  runFfmpeg,
} from './ffmpeg.ts'

const ffmpegAvailable = spawnSync(resolveFfmpegPath(), ['-version'], { timeout: 5000 }).status === 0
const mediaTest = ffmpegAvailable ? test : test.skip

describe('audio mux duration contract', () => {
  mediaTest('keeps video as the duration source for short, long, and absent audio', async () => {
    const root = mkdtempSync(join(tmpdir(), 'crab-audio-contract-'))
    try {
      const video = join(root, 'video.mp4')
      const generated = await runFfmpeg([
        '-y', '-f', 'lavfi', '-i', 'color=c=red:s=64x64:r=10:d=1',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', video,
      ], { timeoutMs: 30_000 })
      expect(generated.code).toBe(0)
      const videoDuration = await probeDurationSec(video)

      const cases: Array<{ name: string; audio: string | null; duration?: number }> = [
        { name: 'none', audio: null },
        { name: 'short', audio: join(root, 'short.m4a'), duration: 0.25 },
        { name: 'long', audio: join(root, 'long.m4a'), duration: 2 },
      ]
      for (const item of cases) {
        if (item.audio) await generateToneAudio(item.audio, item.duration!)
        const output = join(root, `${item.name}.mp4`)
        await muxAudio(video, item.audio, output)
        expect(Math.abs((await probeDurationSec(output)) - videoDuration)).toBeLessThanOrEqual(0.25)
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 60_000)
})
