import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { actionRequired, err, ok, type Envelope } from '../envelope.ts'
import { OriginalityScanSchema, OriginalityHumanReviewSchema, namedActorsEqual, stableHash, type OriginalityScan } from '../domain.ts'
import { appendRecordsAtomically, listRecords, StorageConflictError, storageWarnings } from '../storage.ts'
import { getLatestContent } from './content.ts'
import { loadReferenceRecords } from './references.ts'

export const ORIGINALITY_ALGORITHM_VERSION = 'literal-structure@2'
export const ORIGINALITY_POLICY_VERSION = 'originality-risk@1'
const NGRAM_SIZES = [4, 8, 12]
const PARAGRAPH_THRESHOLD = 0.55
const PARAGRAPH_CANDIDATE_LIMIT = 64
const MAX_DRAFT_PARAGRAPHS = 2_000
const MAX_REFERENCE_PARAGRAPHS = 5_000
const MAX_NORMALIZED_DRAFT_CHARACTERS = 300_000
const MAX_NORMALIZED_REFERENCE_CHARACTERS = 500_000
const MAX_NORMALIZED_REFERENCE_ITEM_CHARACTERS = 100_000

function normalize(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[^0-9a-z\u3400-\u9fff]+/g, '')
}

function ngramSet(value: string, size: number): Set<string> {
  const out = new Set<string>()
  for (let index = 0; index <= value.length - size; index++) out.add(value.slice(index, index + size))
  return out
}

function similarity(left: string, right: string): number {
  const a = ngramSet(normalize(left), 2)
  const b = ngramSet(normalize(right), 2)
  if (!a.size || !b.size) return 0
  let intersection = 0
  for (const token of a) if (b.has(token)) intersection++
  return (2 * intersection) / (a.size + b.size)
}

type ParagraphVector = { tokens: Set<string>; signatures: string[] }

function tokenHash(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function paragraphVector(value: string): ParagraphVector {
  const normalized = normalize(value)
  const tokens = normalized.length >= 2 ? ngramSet(normalized, 2) : new Set(normalized ? [`single:${normalized}`] : [])
  const signatures = [...tokens]
    .map((token) => ({ token, hash: tokenHash(token) }))
    .sort((left, right) => left.hash - right.hash || (left.token < right.token ? -1 : left.token > right.token ? 1 : 0))
    .slice(0, 8)
    .map(({ hash, token }) => `${hash}:${token}`)
  return { tokens, signatures }
}

function vectorSimilarity(left: ParagraphVector, right: ParagraphVector): number {
  if (!left.tokens.size || !right.tokens.size) return 0
  const [small, large] = left.tokens.size <= right.tokens.size ? [left.tokens, right.tokens] : [right.tokens, left.tokens]
  let intersection = 0
  for (const token of small) if (large.has(token)) intersection++
  return (2 * intersection) / (left.tokens.size + right.tokens.size)
}

function paragraphMatches(draft: ParagraphVector[], reference: ParagraphVector[]): Array<{ draftIndex: number; referenceIndex: number; similarity: number }> {
  if (!draft.length || !reference.length) return []
  const signatureIndex = new Map<string, number[]>()
  for (const [referenceIndex, vector] of reference.entries()) {
    for (const signature of vector.signatures) {
      const indexes = signatureIndex.get(signature) ?? []
      if (indexes.length < PARAGRAPH_CANDIDATE_LIMIT) indexes.push(referenceIndex)
      signatureIndex.set(signature, indexes)
    }
  }
  const matches: Array<{ draftIndex: number; referenceIndex: number; similarity: number }> = []
  for (const [draftIndex, vector] of draft.entries()) {
    const candidates = new Set<number>()
    const aligned = Math.round((draftIndex / Math.max(1, draft.length - 1)) * Math.max(0, reference.length - 1))
    for (let offset = -4; offset <= 4; offset++) {
      const referenceIndex = aligned + offset
      if (referenceIndex >= 0 && referenceIndex < reference.length) candidates.add(referenceIndex)
    }
    for (const signature of vector.signatures) {
      for (const referenceIndex of signatureIndex.get(signature) ?? []) {
        if (candidates.size >= PARAGRAPH_CANDIDATE_LIMIT) break
        candidates.add(referenceIndex)
      }
      if (candidates.size >= PARAGRAPH_CANDIDATE_LIMIT) break
    }
    let best = { referenceIndex: 0, similarity: 0 }
    for (const referenceIndex of candidates) {
      const score = vectorSimilarity(vector, reference[referenceIndex])
      if (score > best.similarity) best = { referenceIndex, similarity: score }
    }
    if (best.similarity >= PARAGRAPH_THRESHOLD) matches.push({ draftIndex, ...best })
  }
  return matches
}

function longestMatch(draft: string, reference: string, globalDraftCovered: Uint8Array): { length: number; text: string; referenceCoverage: number } {
  const seed = 8
  if (draft.length < seed || reference.length < seed) return { length: 0, text: '', referenceCoverage: 0 }
  const referenceSeeds = ngramSet(reference, seed)
  const draftSeeds = ngramSet(draft, seed)
  const referenceCovered = new Uint8Array(reference.length)

  for (let position = 0; position <= draft.length - seed; position++) {
    if (!referenceSeeds.has(draft.slice(position, position + seed))) continue
    for (let offset = 0; offset < seed; offset++) globalDraftCovered[position + offset] = 1
  }
  for (let position = 0; position <= reference.length - seed; position++) {
    if (!draftSeeds.has(reference.slice(position, position + seed))) continue
    for (let offset = 0; offset < seed; offset++) referenceCovered[position + offset] = 1
  }

  type State = { length: number; link: number; next: Map<string, number> }
  const states: State[] = [{ length: 0, link: -1, next: new Map() }]
  let last = 0
  for (const character of reference) {
    const current = states.length
    states.push({ length: states[last].length + 1, link: 0, next: new Map() })
    let cursor = last
    while (cursor >= 0 && !states[cursor].next.has(character)) {
      states[cursor].next.set(character, current)
      cursor = states[cursor].link
    }
    if (cursor < 0) states[current].link = 0
    else {
      const target = states[cursor].next.get(character)!
      if (states[cursor].length + 1 === states[target].length) states[current].link = target
      else {
        const clone = states.length
        states.push({ length: states[cursor].length + 1, link: states[target].link, next: new Map(states[target].next) })
        while (cursor >= 0 && states[cursor].next.get(character) === target) {
          states[cursor].next.set(character, clone)
          cursor = states[cursor].link
        }
        states[target].link = clone
        states[current].link = clone
      }
    }
    last = current
  }

  let state = 0
  let matched = 0
  let bestLength = 0
  let bestEnd = -1
  for (let index = 0; index < draft.length; index++) {
    const character = draft[index]
    while (state !== 0 && !states[state].next.has(character)) {
      state = states[state].link
      matched = Math.min(matched, states[state].length)
    }
    const next = states[state].next.get(character)
    if (next !== undefined) {
      state = next
      matched++
    } else {
      state = 0
      matched = 0
    }
    if (matched > bestLength) {
      bestLength = matched
      bestEnd = index
    }
  }
  const coveredReference = referenceCovered.reduce((sum, value) => sum + value, 0)
  return {
    length: bestLength,
    text: bestEnd >= 0 ? draft.slice(bestEnd - bestLength + 1, bestEnd + 1) : '',
    referenceCoverage: reference.length ? coveredReference / reference.length : 0,
  }
}

function paragraphList(value: string): string[] {
  return value
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.replace(/^#{1,6}\s+/gm, '').trim())
    .filter(Boolean)
}

function outlineScore(draft: string, reference: string): number {
  const draftHeadings = [...draft.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => match[1])
  const referenceHeadings = [...reference.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => match[1])
  const draftParagraphs = paragraphList(draft)
  const referenceParagraphs = paragraphList(reference)
  const countScore = Math.min(draftParagraphs.length, referenceParagraphs.length) / Math.max(1, Math.max(draftParagraphs.length, referenceParagraphs.length))
  if (!draftHeadings.length || !referenceHeadings.length) return countScore * 0.5
  const length = Math.min(draftHeadings.length, referenceHeadings.length)
  const headingScore = Array.from({ length }, (_, index) => similarity(draftHeadings[index], referenceHeadings[index])).reduce((sum, value) => sum + value, 0) / Math.max(1, length)
  return Math.min(1, headingScore * 0.7 + countScore * 0.3)
}

function scanHashPayload(scan: Omit<OriginalityScan, 'scanHash'>): unknown {
  return {
    scanId: scan.scanId,
    contentId: scan.contentId,
    sourceRevisionId: scan.sourceRevisionId,
    subjectHash: scan.subjectHash,
    referenceHashes: scan.referenceHashes,
    quotations: scan.quotations,
    algorithmVersion: scan.algorithmVersion,
    policyVersion: scan.policyVersion,
    parameters: scan.parameters,
    exactMatches: scan.exactMatches,
    longestNormalizedMatch: scan.longestNormalizedMatch,
    draftCoverage: scan.draftCoverage,
    referenceCoverage: scan.referenceCoverage,
    ngramMatches: scan.ngramMatches,
    paragraphAlignments: scan.paragraphAlignments,
    outlineSimilarity: scan.outlineSimilarity,
    semanticFlags: scan.semanticFlags,
    decision: scan.decision,
    reviewRequired: scan.reviewRequired,
    createdAt: scan.createdAt,
    createdBy: scan.createdBy,
    humanReview: scan.humanReview,
  }
}

const scanSchema = z.object({
  contentId: z.string().uuid(),
  createdBy: z.string().min(1),
  quotations: z.array(z.object({
    referenceId: z.string().uuid(),
    text: z.string().min(1).max(200),
    attribution: z.string().min(1).max(300),
    locator: z.string().min(1).max(300),
  })).max(20).default([]),
})
export const scanName = 'mediaops.originality.scan'
export const scanDescription =
  'Generate version-bound multi-scale literal, coverage, longest-run, paragraph-alignment and outline risk evidence against registered references. It reports risk, never an originality percentage or legal conclusion.'
export const scanInputSchema = scanSchema.shape

export async function scanHandler(args: z.input<typeof scanSchema>): Promise<Envelope> {
  const parsed = scanSchema.safeParse(args)
  if (!parsed.success) return err('INVALID_ORIGINALITY_SCAN', parsed.error.message)
  const content = await getLatestContent(parsed.data.contentId)
  if (!content) return err('NOT_FOUND', `No content ${parsed.data.contentId}.`)
  if (!('schemaVersion' in content) || content.schemaVersion !== 2) return err('SCHEMA_UPGRADE_REQUIRED', 'Originality scanning requires schema v2 content.')
  if (content.stage !== 'drafted') return err('INVALID_STAGE_TRANSITION', `Originality scanning requires a drafted revision; current stage is ${content.stage}.`)
  if (namedActorsEqual(parsed.data.createdBy, content.savedBy)) return err('ROLE_SEPARATION_REQUIRED', 'The draft author cannot be the independent originality scanner.')

  let references
  try {
    references = await loadReferenceRecords(content.referenceIds)
  } catch (error) {
    return err('REFERENCE_EVIDENCE_REQUIRED', error instanceof Error ? error.message : String(error))
  }
  let draftText = [
    content.title,
    content.summary,
    content.bodyMarkdown,
    ...content.articleDoc.citations.flatMap((citation) => [citation.title, citation.publisher, citation.publishedAt?.slice(0, 10)]),
    ...content.articleDoc.assets.flatMap((asset) => [asset.alt, asset.caption]),
    ...content.articleDoc.disclosures,
  ].filter((value): value is string => Boolean(value)).join('\n\n')
  const referenceById = new Map(references.map((reference) => [reference.metadata.referenceId, reference]))
  for (const quotation of parsed.data.quotations) {
    const reference = referenceById.get(quotation.referenceId)
    const first = draftText.indexOf(quotation.text)
    if (!reference || !reference.metadata.allowedUses.includes('attributed_quotation')) {
      return err('INVALID_ATTRIBUTED_QUOTATION', `Reference ${quotation.referenceId} is missing or does not permit attributed quotation.`)
    }
    if (normalize(quotation.text).length > 80) return err('INVALID_ATTRIBUTED_QUOTATION', 'A quotation exclusion may contain at most 80 normalized characters.')
    if (first < 0 || draftText.lastIndexOf(quotation.text) !== first || !reference.rawText.includes(quotation.text) || !draftText.includes(quotation.attribution)) {
      return err('INVALID_ATTRIBUTED_QUOTATION', 'Each excluded quotation must occur exactly once in both draft and reference and include its named attribution in the draft.')
    }
    draftText = `${draftText.slice(0, first)}${' '.repeat(quotation.text.length)}${draftText.slice(first + quotation.text.length)}`
  }
  const normalizedDraft = normalize(draftText)
  if (normalizedDraft.length > MAX_NORMALIZED_DRAFT_CHARACTERS) {
    return err('ORIGINALITY_INPUT_TOO_LARGE', `Normalized draft has ${normalizedDraft.length} characters; the deterministic scan limit is ${MAX_NORMALIZED_DRAFT_CHARACTERS}. Split the work or shorten the publishable article.`)
  }
  const normalizedReferences = references.map((reference) => ({ reference, text: normalize(reference.rawText) }))
  const oversizedReference = normalizedReferences.find((item) => item.text.length > MAX_NORMALIZED_REFERENCE_ITEM_CHARACTERS)
  if (oversizedReference) {
    return err('ORIGINALITY_INPUT_TOO_LARGE', `Reference ${oversizedReference.reference.metadata.referenceId} has ${oversizedReference.text.length} normalized characters; the per-reference scan limit is ${MAX_NORMALIZED_REFERENCE_ITEM_CHARACTERS}. Split the comparison material before scanning.`)
  }
  const totalReferenceCharacters = normalizedReferences.reduce((sum, item) => sum + item.text.length, 0)
  if (totalReferenceCharacters > MAX_NORMALIZED_REFERENCE_CHARACTERS) {
    return err('ORIGINALITY_INPUT_TOO_LARGE', `Registered references contain ${totalReferenceCharacters} normalized characters; the scan limit is ${MAX_NORMALIZED_REFERENCE_CHARACTERS}. Reduce or split the comparison set.`)
  }
  let longestNormalizedMatch = 0
  let draftCoverage = 0
  let referenceCoverage = 0
  let outlineSimilarity = 0
  const ngramMatches: Record<string, number> = Object.fromEntries(NGRAM_SIZES.map((size) => [String(size), 0]))
  const exactMatches: OriginalityScan['exactMatches'] = []
  const paragraphAlignments: OriginalityScan['paragraphAlignments'] = []
  const globalDraftCovered = new Uint8Array(normalizedDraft.length)
  const draftNgrams = new Map(NGRAM_SIZES.map((size) => [size, ngramSet(normalizedDraft, size)]))
  const draftParagraphs = paragraphList(draftText)
  const referenceParagraphs = normalizedReferences.map(({ reference }) => ({
    referenceId: reference.metadata.referenceId,
    paragraphs: paragraphList(reference.rawText),
  }))
  const totalReferenceParagraphs = referenceParagraphs.reduce((sum, item) => sum + item.paragraphs.length, 0)
  if (draftParagraphs.length > MAX_DRAFT_PARAGRAPHS || totalReferenceParagraphs > MAX_REFERENCE_PARAGRAPHS) {
    return err('ORIGINALITY_INPUT_TOO_LARGE', `Paragraph alignment has ${draftParagraphs.length} draft and ${totalReferenceParagraphs} reference paragraphs; limits are ${MAX_DRAFT_PARAGRAPHS} and ${MAX_REFERENCE_PARAGRAPHS}. Consolidate or split the comparison set.`)
  }
  const draftParagraphVectors = draftParagraphs.map(paragraphVector)
  const referenceParagraphsById = new Map(referenceParagraphs.map((item) => [item.referenceId, item.paragraphs]))

  for (const { reference, text: normalizedReference } of normalizedReferences) {
    for (const size of NGRAM_SIZES) {
      const draft = draftNgrams.get(size)!
      const comparison = ngramSet(normalizedReference, size)
      let count = 0
      for (const token of draft) if (comparison.has(token)) count++
      ngramMatches[String(size)] += count
    }
    const longest = longestMatch(normalizedDraft, normalizedReference, globalDraftCovered)
    longestNormalizedMatch = Math.max(longestNormalizedMatch, longest.length)
    referenceCoverage = Math.max(referenceCoverage, longest.referenceCoverage)
    if (longest.length >= 8) exactMatches.push({ referenceId: reference.metadata.referenceId, text: longest.text.slice(0, 200), length: longest.length })

    const currentReferenceParagraphs = referenceParagraphsById.get(reference.metadata.referenceId) ?? []
    for (const match of paragraphMatches(draftParagraphVectors, currentReferenceParagraphs.map(paragraphVector))) {
      paragraphAlignments.push({ referenceId: reference.metadata.referenceId, ...match })
    }
    outlineSimilarity = Math.max(outlineSimilarity, outlineScore(draftText, reference.rawText))
  }
  draftCoverage = normalizedDraft.length ? globalDraftCovered.reduce((sum, value) => sum + value, 0) / normalizedDraft.length : 0

  // Reference roles and rights are caller classifications, not proof that an
  // expressive source is safe to imitate. Every bound reference therefore
  // requires a separate semantic/structural human review.
  const thirdPartyReview = references.length > 0
  let decision: OriginalityScan['decision'] = 'low_risk'
  if (longestNormalizedMatch >= 40 || draftCoverage >= 0.2) decision = 'blocked'
  else if (longestNormalizedMatch >= 16 || draftCoverage >= 0.08 || paragraphAlignments.some((alignment) => alignment.similarity >= 0.8)) decision = 'changes_required'
  else if (thirdPartyReview || outlineSimilarity >= 0.65) decision = 'human_review_required'
  const reviewRequired = decision === 'human_review_required'
  const semanticFlags = thirdPartyReview
    ? ['第三方或获授权样本仍需人工比较观点、案例组合、独特比喻、论证路径和结论推进；字面扫描不能证明语义独立。']
    : []
  const scanId = randomUUID()
  const createdAt = new Date().toISOString()
  const withoutHash: Omit<OriginalityScan, 'scanHash'> = {
    scanId,
    contentId: content.contentId,
    sourceRevisionId: content.revisionId,
    subjectHash: content.originalitySubjectHash,
    referenceHashes: references.map(({ metadata }) => ({ referenceId: metadata.referenceId, contentHash: metadata.contentHash, role: metadata.role })),
    quotations: parsed.data.quotations,
    algorithmVersion: ORIGINALITY_ALGORITHM_VERSION,
    policyVersion: ORIGINALITY_POLICY_VERSION,
    parameters: { ngramSizes: NGRAM_SIZES, paragraphThreshold: PARAGRAPH_THRESHOLD, paragraphCandidateLimit: PARAGRAPH_CANDIDATE_LIMIT },
    exactMatches: exactMatches.sort((left, right) => right.length - left.length).slice(0, 20),
    longestNormalizedMatch,
    draftCoverage,
    referenceCoverage,
    ngramMatches,
    paragraphAlignments: paragraphAlignments.slice(0, 100),
    outlineSimilarity,
    semanticFlags,
    decision,
    reviewRequired,
    createdAt,
    createdBy: parsed.data.createdBy,
  }
  const scanHash = stableHash(scanHashPayload(withoutHash))
  const scan = OriginalityScanSchema.parse({ ...withoutHash, scanHash })
  await appendRecordsAtomically([
    { collection: 'originality-scans', record: { id: scanId, ...scan }, guard: {
      entityKey: scanId,
      expectedEntityVersion: null,
      entityVersion: 1,
    } },
    { collection: 'audit-events', record: {
      event: 'originality.scanned',
      scanId,
      contentId: content.contentId,
      revisionId: content.revisionId,
      subjectHash: content.originalitySubjectHash,
      decision,
      actor: parsed.data.createdBy,
    } },
  ])
  const data = { scanId, decision, reviewRequired, subjectHash: scan.subjectHash, longestNormalizedMatch, draftCoverage, referenceCoverage, outlineSimilarity, semanticFlags }
  return decision === 'low_risk' ? ok(data, storageWarnings()) : actionRequired(data, storageWarnings())
}

const reviewSchema = z.object({
  scanId: z.string().uuid(),
  decision: z.enum(['pass', 'changes_required']),
  reviewedBy: z.string().min(1),
  rationale: z.string().min(20).max(3000),
  structureIndependent: z.boolean(),
  argumentIndependent: z.boolean(),
  attributedQuotations: z.array(z.string().min(1).max(500)).default([]),
})

export const reviewName = 'mediaops.originality.review'
export const reviewDescription = 'Record an independent human editorial decision for a scan that requires semantic/structural review. Blocked literal-copy scans cannot be overridden.'
export const reviewInputSchema = reviewSchema.shape

export async function reviewHandler(args: z.input<typeof reviewSchema>): Promise<Envelope> {
  const parsed = reviewSchema.safeParse(args)
  if (!parsed.success) return err('INVALID_ORIGINALITY_REVIEW', parsed.error.message)
  const scan = await getOriginalityScan(parsed.data.scanId)
  if (!scan) return err('NOT_FOUND', `No originality scan ${parsed.data.scanId}.`)
  if (scan.humanReview) return err('ORIGINALITY_REVIEW_FINAL', `Scan ${scan.scanId} already has terminal human decision ${scan.humanReview.decision}; create a new draft and scan.`)
  if (scan.decision !== 'human_review_required') return err('ORIGINALITY_DECISION_NOT_REVIEWABLE', `Scan decision ${scan.decision} requires a new draft and scan, not an override.`)
  const content = await getLatestContent(scan.contentId)
  if (!content || !('schemaVersion' in content) || content.schemaVersion !== 2 || content.originalitySubjectHash !== scan.subjectHash) {
    return err('ORIGINALITY_SCAN_STALE', 'The draft changed after this scan.')
  }
  if (namedActorsEqual(parsed.data.reviewedBy, content.savedBy) || namedActorsEqual(parsed.data.reviewedBy, scan.createdBy)) {
    return err('ROLE_SEPARATION_REQUIRED', 'The originality reviewer must differ from the draft author and scanner.')
  }
  if (parsed.data.decision === 'pass' && (!parsed.data.structureIndependent || !parsed.data.argumentIndependent)) {
    return err('ORIGINALITY_REVIEW_INCOMPLETE', 'A pass requires both structural and argument independence to be explicitly confirmed.')
  }
  const humanReview = OriginalityHumanReviewSchema.parse({ ...parsed.data, reviewedAt: new Date().toISOString() })
  const withoutHash: Omit<OriginalityScan, 'scanHash'> = { ...scan, humanReview }
  const scanHash = stableHash(scanHashPayload(withoutHash))
  const updated = OriginalityScanSchema.parse({ ...withoutHash, scanHash })
  try {
    await appendRecordsAtomically([
      { collection: 'originality-scans', record: { id: randomUUID(), ...updated }, guard: {
        entityKey: scan.scanId,
        expectedEntityVersion: 1,
        entityVersion: 2,
      } },
      { collection: 'audit-events', record: {
        event: `originality.review.${humanReview.decision}`,
        scanId: scan.scanId,
        contentId: scan.contentId,
        subjectHash: scan.subjectHash,
        actor: humanReview.reviewedBy,
      } },
    ])
  } catch (error) {
    if (error instanceof StorageConflictError) return err('ORIGINALITY_REVIEW_CONFLICT', 'Another reviewer finalized this scan; reload it before continuing.')
    throw error
  }
  return humanReview.decision === 'pass' ? ok({ scanId: scan.scanId, decision: humanReview.decision, scanHash }, storageWarnings()) : actionRequired({ scanId: scan.scanId, decision: humanReview.decision, scanHash }, storageWarnings())
}

export async function getOriginalityScan(scanId: string): Promise<OriginalityScan | null> {
  const records = await listRecords('originality-scans', { scanId })
  if (!records.length) return null
  const parsed = OriginalityScanSchema.safeParse(records[records.length - 1])
  if (!parsed.success) throw new Error(`INVALID_STORED_ORIGINALITY_SCAN:${scanId}`)
  const { scanHash, ...withoutHash } = parsed.data
  if (stableHash(scanHashPayload(withoutHash)) !== scanHash) throw new Error(`ORIGINALITY_SCAN_HASH_MISMATCH:${scanId}`)
  return parsed.data
}

export function originalityScanPasses(scan: OriginalityScan): boolean {
  return scan.decision === 'low_risk' || (scan.decision === 'human_review_required' && scan.humanReview?.decision === 'pass')
}
