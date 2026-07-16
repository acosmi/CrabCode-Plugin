import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { err, ok, type Envelope } from '../envelope.ts'
import {
  ReferenceAllowedUseSchema,
  ReferenceMaterialSchema,
  ReferenceRoleSchema,
  SafeHttpUrlSchema,
  stableHash,
  type ReferenceMaterial,
} from '../domain.ts'
import { appendRecordsAtomically, getRecord, listRecords, storageWarnings } from '../storage.ts'

const registerSchema = z.object({
  role: ReferenceRoleSchema,
  rightsStatus: z.enum(['owned', 'licensed', 'public_domain', 'unknown']),
  allowedUses: z.array(ReferenceAllowedUseSchema).min(1),
  title: z.string().min(1).max(300),
  url: SafeHttpUrlSchema.optional(),
  rawText: z.string().min(1).max(500_000),
  doNotCopyFeatures: z.array(z.string().min(1).max(240)).max(24).default([]),
  registeredBy: z.string().min(1),
})

export type ReferenceRecord = { metadata: ReferenceMaterial; rawText: string }

export const registerName = 'mediaops.reference.register'
export const registerDescription =
  'Classify and hash a reference before writing. Third-party text is stored in the protected reference collection and returned only as metadata, never as a writer payload.'
export const registerInputSchema = registerSchema.shape

function normalizeReferenceText(value: string): string {
  return value.normalize('NFC').replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim()
}

export async function registerHandler(args: z.input<typeof registerSchema>): Promise<Envelope> {
  const parsed = registerSchema.safeParse(args)
  if (!parsed.success) return err('INVALID_REFERENCE', parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '))
  const input = parsed.data
  const referenceId = randomUUID()
  const registeredAt = new Date().toISOString()
  const rawText = normalizeReferenceText(input.rawText)
  const candidate = {
    referenceId,
    role: input.role,
    rightsStatus: input.rightsStatus,
    allowedUses: input.allowedUses,
    title: input.title,
    ...(input.url ? { url: input.url } : {}),
    contentHash: stableHash(rawText),
    eligibleAsEvidence: false,
    doNotCopyFeatures: input.doNotCopyFeatures,
    registeredAt,
    registeredBy: input.registeredBy,
  }
  const metadata = ReferenceMaterialSchema.safeParse(candidate)
  if (!metadata.success) {
    const rightsIssue = metadata.error.issues.some((issue) => issue.path.includes('rightsStatus'))
    return err(rightsIssue ? 'REFERENCE_RIGHTS_REQUIRED' : 'REFERENCE_USAGE_NOT_ALLOWED', metadata.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '))
  }
  await appendRecordsAtomically([
    { collection: 'references', record: { id: referenceId, ...metadata.data, rawText } },
    { collection: 'audit-events', record: {
      event: 'reference.registered',
      referenceId,
      role: metadata.data.role,
      contentHash: metadata.data.contentHash,
      actor: input.registeredBy,
    } },
  ])
  return ok({ reference: metadata.data, rawTextStored: true, writerPayloadContainsRawText: false }, storageWarnings())
}

export const getName = 'mediaops.reference.get_metadata'
export const getDescription = 'Return reference classification, rights, hash and do-not-copy metadata without returning the stored reference text.'
export const getInputSchema = { referenceId: z.string().uuid() }

export async function getHandler(args: { referenceId: string }): Promise<Envelope> {
  const record = await getRecord('references', args.referenceId)
  if (!record) return err('NOT_FOUND', `No reference ${args.referenceId}.`)
  const metadata = ReferenceMaterialSchema.safeParse(record)
  if (!metadata.success) return err('INVALID_STORED_REFERENCE', `Stored reference ${args.referenceId} is invalid.`)
  return ok(metadata.data, storageWarnings())
}

export async function loadReferenceRecords(referenceIds: string[]): Promise<ReferenceRecord[]> {
  const unique = [...new Set(referenceIds)]
  const all = await listRecords('references')
  const byId = new Map(all.map((record) => [String(record.referenceId), record]))
  return unique.map((referenceId) => {
    const record = byId.get(referenceId)
    if (!record) throw new Error(`REFERENCE_NOT_FOUND:${referenceId}`)
    const metadata = ReferenceMaterialSchema.parse(record)
    if (typeof record.rawText !== 'string') throw new Error(`REFERENCE_TEXT_MISSING:${referenceId}`)
    const rawText = normalizeReferenceText(record.rawText)
    if (stableHash(rawText) !== metadata.contentHash) throw new Error(`REFERENCE_HASH_MISMATCH:${referenceId}`)
    return { metadata, rawText }
  })
}
