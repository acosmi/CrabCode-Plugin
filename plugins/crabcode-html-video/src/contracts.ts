import { z } from 'zod/v4'

export const RENDER_LIMITS = {
  maxSegments: 40,
  maxFrameHtmlChars: 256 * 1024,
  maxFrameHtmlBytes: 256 * 1024,
  maxTotalHtmlBytes: 5_000_000,
  minDurationSec: 0.1,
  maxSegmentDurationSec: 30,
  maxTotalDurationSec: 120,
  minDimension: 64,
  maxDimension: 3840,
  maxPixels: 8_294_400,
  minFps: 1,
  maxFps: 60,
  maxTotalFrames: 7_200,
  maxPixelFrames: 1920 * 1080 * 120 * 30,
  maxGraphBytes: 1_000_000,
} as const

export const frameIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'id must use only letters, digits, _ and -')

export const outputNameSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*\.mp4$/i, 'outputName must be a basename ending in .mp4')

export const dimensionSchema = z
  .number()
  .finite()
  .int()
  .min(RENDER_LIMITS.minDimension)
  .max(RENDER_LIMITS.maxDimension)
  .refine((value) => value % 2 === 0, 'dimension must be even for yuv420p output')

export const heightDimensionSchema = z
  .number()
  .finite()
  .int()
  .min(RENDER_LIMITS.minDimension)
  .max(2160)
  .refine((value) => value % 2 === 0, 'dimension must be even for yuv420p output')

export const fpsSchema = z
  .number()
  .finite()
  .int()
  .min(RENDER_LIMITS.minFps)
  .max(RENDER_LIMITS.maxFps)

export const durationSchema = z
  .number()
  .finite()
  .min(RENDER_LIMITS.minDurationSec)
  .max(RENDER_LIMITS.maxSegmentDurationSec)

export const htmlSchema = z.string().min(1).max(RENDER_LIMITS.maxFrameHtmlChars)

export const renderSegmentSchema = z
  .object({
    id: frameIdSchema,
    html: htmlSchema,
    durationSec: durationSchema,
  })
  .strict()

export const renderFramesInputSchema = z
  .object({
    segments: z
      .array(renderSegmentSchema)
      .min(1)
      .max(RENDER_LIMITS.maxSegments)
      .describe('Independent, declarative HTML frame segments in playback order'),
    width: dimensionSchema.optional().describe('Output width in pixels; default 1280'),
    height: heightDimensionSchema.optional().describe('Output height in pixels; default 720'),
    fps: fpsSchema.optional().describe('Frames per second; default 30'),
    audioPath: z
      .string()
      .min(1)
      .max(4096)
      .optional()
      .describe('Optional audio file under plugin inputs or an administrator-configured allowed root'),
    outputName: outputNameSchema.optional().describe('Safe MP4 basename inside plugin outputs'),
    confirmed: z.boolean().describe('Must be true only after the user explicitly approves this exact render'),
  })
  .strict()

export const lintFrameInputSchema = z
  .object({
    html: htmlSchema,
    id: frameIdSchema.optional(),
    width: dimensionSchema.optional(),
    height: heightDimensionSchema.optional(),
    durationSec: durationSchema.optional(),
    wrap: z.boolean().optional(),
  })
  .strict()

export const previewFrameInputSchema = z
  .object({
    html: htmlSchema,
    id: frameIdSchema.optional(),
    width: dimensionSchema.optional(),
    height: heightDimensionSchema.optional(),
    durationSec: durationSchema.max(5).optional(),
    render: z.boolean().optional(),
    confirmed: z.boolean().optional(),
  })
  .strict()

const baseNodeSchema = z.object({
  id: frameIdSchema,
  label: z.string().max(200).optional(),
  frameIntent: z.string().max(100).optional(),
  durationSec: durationSchema.optional(),
})

const contentNodeSchema = z.discriminatedUnion('kind', [
  baseNodeSchema.extend({ kind: z.literal('entity'), props: z.record(z.string(), z.unknown()) }).strict(),
  baseNodeSchema.extend({ kind: z.literal('data'), data: z.unknown() }).strict(),
  baseNodeSchema.extend({ kind: z.literal('text'), text: z.string().min(1).max(10_000) }).strict(),
])

const edgeSchema = z
  .object({
    from: frameIdSchema,
    to: frameIdSchema,
    kind: z.enum(['sequence', 'contrast', 'dependency']),
    reason: z.string().max(500).optional(),
  })
  .strict()

export const contentGraphSchema = z
  .object({
    schemaVersion: z.literal(1),
    intent: z.enum(['single-frame', 'explainer', 'data-viz', 'promo', 'comparison', 'other']),
    synopsis: z.string().max(500).optional(),
    nodes: z.array(contentNodeSchema).min(1).max(RENDER_LIMITS.maxSegments),
    edges: z.array(edgeSchema).max(400),
  })
  .strict()
  .superRefine((graph, context) => {
    const durationSec = graph.nodes.reduce((sum, node) => sum + (node.durationSec ?? 3), 0)
    if (durationSec > RENDER_LIMITS.maxTotalDurationSec) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nodes'],
        message: `graph duration ${durationSec}s exceeds ${RENDER_LIMITS.maxTotalDurationSec}s`,
      })
    }
    const bytes = Buffer.byteLength(JSON.stringify(graph), 'utf8')
    if (bytes > RENDER_LIMITS.maxGraphBytes) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `graph payload ${bytes} bytes exceeds ${RENDER_LIMITS.maxGraphBytes}`,
      })
    }
  })

export const validateGraphInputSchema = z.object({ graph: contentGraphSchema }).strict()

export const doctorInputSchema = z
  .object({
    install: z.boolean().optional().describe('Download the pinned browser when one is missing'),
    useMirror: z.boolean().optional().describe('Opt in to the configured domestic mirror; official CDN is the default'),
  })
  .strict()

export function validationMessage(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
    .join('; ')
}

export function validateRenderCrossFields(input: z.infer<typeof renderFramesInputSchema>): string | null {
  const totalDuration = input.segments.reduce((sum, segment) => sum + segment.durationSec, 0)
  if (totalDuration > RENDER_LIMITS.maxTotalDurationSec) {
    return `total duration ${totalDuration}s exceeds ${RENDER_LIMITS.maxTotalDurationSec}s`
  }

  const totalHtmlBytes = input.segments.reduce((sum, segment) => sum + Buffer.byteLength(segment.html, 'utf8'), 0)
  if (totalHtmlBytes > RENDER_LIMITS.maxTotalHtmlBytes) {
    return `total HTML size ${totalHtmlBytes} bytes exceeds ${RENDER_LIMITS.maxTotalHtmlBytes}`
  }
  for (const segment of input.segments) {
    const bytes = Buffer.byteLength(segment.html, 'utf8')
    if (bytes > RENDER_LIMITS.maxFrameHtmlBytes) {
      return `segment ${segment.id} HTML size ${bytes} bytes exceeds ${RENDER_LIMITS.maxFrameHtmlBytes}`
    }
  }

  const width = input.width ?? 1280
  const height = input.height ?? 720
  if (width * height > RENDER_LIMITS.maxPixels) {
    return `frame pixel count ${width * height} exceeds ${RENDER_LIMITS.maxPixels}`
  }

  const fps = input.fps ?? 30
  const totalFrames = input.segments.reduce(
    (sum, segment) => sum + Math.ceil(segment.durationSec * fps),
    0,
  )
  if (totalFrames > RENDER_LIMITS.maxTotalFrames) {
    return `total frame count ${totalFrames} exceeds ${RENDER_LIMITS.maxTotalFrames}`
  }
  const pixelFrames = width * height * totalFrames
  if (pixelFrames > RENDER_LIMITS.maxPixelFrames) {
    return `pixel-frame work ${pixelFrames} exceeds ${RENDER_LIMITS.maxPixelFrames}`
  }

  const seen = new Set<string>()
  for (const segment of input.segments) {
    if (seen.has(segment.id)) return `duplicate segment id: ${segment.id}`
    seen.add(segment.id)
  }
  return null
}
