/**
 * @crabcode/multi-segment
 *
 * Thin orchestration over hyperframes producer: render each independent HTML
 * frame segment, concat demuxed video streams with matching encode params,
 * optionally mux a full-timeline audio track.
 *
 * Upstream producer accepts a single source (projectDir | previewUrl | html).
 * This package is the shared "multi independent HTML → mp4" layer that neither
 * hyperframes nor html-video provides on the seek-and-capture path.
 */

export { renderMultiSegment, type MultiSegmentInput, type MultiSegmentResult, type SegmentInput } from './render.ts'
export { concatVideos, muxAudio, probeDurationSec, runFfmpeg, resolveFfmpegPath } from './ffmpeg.ts'
export { ensureBrowser, resolveBrowserPath, type BrowserResolveResult } from './browser.ts'
export {
  renderViaProducerHttp,
  producerHealth,
  type ProducerRenderOptions,
  type ProducerRenderResult,
} from './producerClient.ts'
export { generateToneAudio, generateSilentAudio } from './ffmpeg.ts'
export {
  renderHtmlWithProducer,
  isAlreadyWrappedComposition,
  type HfRenderOptions,
  type HfRenderResult,
  type RenderEngine,
} from './hfRender.ts'
export { resolveSafeOutputPath, assertPathUnderRoots } from './safePath.ts'
