import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { BrandIdSchema, ReferenceAllowedUseSchema, ReferenceRoleSchema, stableHash } from '../domain.ts'
import { err, ok, type Envelope } from '../envelope.ts'
import { appendRecordsAtomically, dataDir, ensureDir, getEntityVersion, listRecords, storageWarnings, type AtomicAppend, type StoredRecord } from '../storage.ts'
import { loadReferenceRecords } from './references.ts'

const ProfileVersionSchema = z.string().regex(/^v-[0-9]{10,17}-[a-f0-9]{8}$/, 'profile version must be a generated immutable version id')
const ProfileReferenceSchema = z.object({
  referenceId: z.string().uuid(),
  role: ReferenceRoleSchema,
  rightsStatus: z.enum(['owned', 'licensed', 'public_domain', 'unknown']),
  allowedUses: z.array(ReferenceAllowedUseSchema).min(1).max(5),
  confidence: z.enum(['low', 'medium', 'high']).default('medium'),
  date: z.string().max(50).optional(),
}).strict()

const profileShape = {
  brand_id: BrandIdSchema,
  name: z.string().min(1),
  persona: z.object({ identity: z.string().min(1), domain: z.array(z.string()).optional(), stance: z.string().optional() }).passthrough(),
  voice: z.object({ tone: z.string().min(1), person: z.string().optional(), formality: z.string().optional(), emoji: z.string().optional() }).passthrough(),
  audience: z.object({ segments: z.array(z.string()).min(1), pain_points: z.array(z.string()).optional(), reading_context: z.string().optional() }).passthrough(),
  columns: z.array(z.object({ name: z.string().min(1), cadence: z.string().optional() }).passthrough()),
  platforms: z.array(z.object({ platform: z.string().min(1), columns: z.array(z.string()).optional() }).passthrough()),
  banned_words: z.array(z.string()),
  style_refs: z.array(ProfileReferenceSchema).max(24).optional(),
  style: z.record(z.unknown()).optional(),
  compliance: z.object({ ai_label_text: z.string().min(1), avoid_domains: z.array(z.string()).optional() }).passthrough(),
}

const ProfileInputSchema = z.object({
  ...profileShape,
  confirmedBy: z.string().min(1),
  source: z.enum(['confirmed-form', 'manual-import', 'rollback']).default('manual-import'),
  sourceFormId: z.string().uuid().optional(),
})

const {
  style: _internalStyleSchema,
  style_refs: _internalStyleRefsSchema,
  ...publicProfileShape
} = profileShape

const PublicProfileImportSchema = z.object({
  ...publicProfileShape,
  confirmedBy: z.string().min(1),
  source: z.literal('manual-import').default('manual-import'),
}).strict()

const StoredProfileSchema = z.object({
  ...profileShape,
  profile_version: ProfileVersionSchema,
  confirmedBy: z.string().min(1),
  confirmedAt: z.string().datetime(),
  source: z.enum(['confirmed-form', 'manual-import', 'rollback']),
  sourceFormId: z.string().uuid().optional(),
  rolledBackFrom: z.string().optional(),
})

export type BrandProfileInput = z.input<typeof ProfileInputSchema>
export type BrandProfile = z.infer<typeof StoredProfileSchema>

function profilesDir(): string {
  return join(dataDir(), 'profiles')
}

function brandDir(brandId: string): string {
  return join(profilesDir(), brandId)
}

function versionsDir(brandId: string): string {
  return join(brandDir(brandId), 'versions')
}

function currentPath(brandId: string): string {
  return join(brandDir(brandId), 'current.json')
}

function versionPath(brandId: string, version: z.infer<typeof ProfileVersionSchema>): string {
  return join(versionsDir(brandId), `${version}.json`)
}

const materializationWarnings = new Map<string, string>()

export function profileStorageWarnings(): string[] {
  const warning = materializationWarnings.get(dataDir())
  return [...storageWarnings(), ...(warning ? [warning] : [])]
}

async function readProfile(path: string, expectedBrandId: string): Promise<BrandProfile | null> {
  if (!existsSync(path)) return null
  try {
    const parsed = StoredProfileSchema.safeParse(JSON.parse(await readFile(path, 'utf8')))
    return parsed.success && parsed.data.brand_id === expectedBrandId ? parsed.data : null
  } catch {
    return null
  }
}

function parseProfileRecord(record: StoredRecord): BrandProfile {
  const parsed = StoredProfileSchema.safeParse(record)
  if (!parsed.success) throw new Error(`INVALID_STORED_PROFILE:${parsed.error.message}`)
  return parsed.data
}

async function databaseProfiles(brandId?: string): Promise<BrandProfile[]> {
  const records = await listRecords('profiles', brandId ? { brand_id: brandId } : undefined)
  return records.map(parseProfileRecord)
}

async function writeDerivedProfile(path: string, serialized: string): Promise<void> {
  const temporary = `${path}.tmp-${randomUUID()}`
  await writeFile(temporary, serialized, 'utf8')
  await rename(temporary, path)
}

async function materializeProfile(profile: BrandProfile): Promise<void> {
  await ensureDir(versionsDir(profile.brand_id))
  const serialized = JSON.stringify(profile, null, 2) + '\n'
  await writeDerivedProfile(versionPath(profile.brand_id, profile.profile_version), serialized)
  await writeDerivedProfile(currentPath(profile.brand_id), serialized)
}

async function materializeProfileBestEffort(profile: BrandProfile): Promise<void> {
  try {
    await materializeProfile(profile)
    materializationWarnings.delete(dataDir())
  } catch (error) {
    materializationWarnings.set(dataDir(), `SQLite contains the authoritative profile, but JSON profile export is pending: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function loadProfile(brandId: string, version?: string): Promise<BrandProfile | null> {
  if (!BrandIdSchema.safeParse(brandId).success) return null
  const stored = await databaseProfiles(brandId)
  if (version) {
    const parsedVersion = ProfileVersionSchema.safeParse(version)
    if (!parsedVersion.success) return null
    const databaseProfile = stored.find((profile) => profile.profile_version === parsedVersion.data)
    if (databaseProfile) {
      await materializeProfileBestEffort(databaseProfile)
      return databaseProfile
    }
    return readProfile(versionPath(brandId, parsedVersion.data), brandId)
  }
  if (stored.length) {
    const current = stored[stored.length - 1]
    await materializeProfileBestEffort(current)
    return current
  }
  return readProfile(currentPath(brandId), brandId)
}

function profilePayloadProblem(input: unknown): string | null {
  const forbiddenKeys = new Set(['rawText', 'fullText', 'articleText', 'sourceText', 'bodyMarkdown', 'fileRef'])
  let totalCharacters = 0
  const visit = (value: unknown, path: string): string | null => {
    if (typeof value === 'string') {
      totalCharacters += value.length
      if (value.length > 2_000) return `${path} exceeds the 2000-character profile-field limit`
      if (totalCharacters > 50_000) return 'profile exceeds the 50000-character aggregate limit'
      return null
    }
    if (Array.isArray(value)) {
      if (value.length > 200) return `${path} has too many items`
      for (const [index, item] of value.entries()) {
        const problem = visit(item, `${path}[${index}]`)
        if (problem) return problem
      }
      return null
    }
    if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        if (forbiddenKeys.has(key)) return `${path ? `${path}.` : ''}${key} is forbidden; register source text in the protected reference collection`
        const problem = visit(item, path ? `${path}.${key}` : key)
        if (problem) return problem
      }
    }
    return null
  }
  return visit(input, 'profile')
}

async function profileReferenceProblem(references: z.infer<typeof ProfileReferenceSchema>[]): Promise<string | null> {
  if (!references.length) return null
  let records
  try {
    records = await loadReferenceRecords(references.map((reference) => reference.referenceId))
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  const byId = new Map(records.map(({ metadata }) => [metadata.referenceId, metadata]))
  for (const reference of references) {
    const metadata = byId.get(reference.referenceId)
    if (!metadata || metadata.role !== reference.role || metadata.rightsStatus !== reference.rightsStatus || stableHash([...metadata.allowedUses].sort()) !== stableHash([...reference.allowedUses].sort())) {
      return `REFERENCE_METADATA_MISMATCH:${reference.referenceId}`
    }
    if (!reference.allowedUses.includes('abstract_style_features')) return `REFERENCE_STYLE_USE_NOT_ALLOWED:${reference.referenceId}`
  }
  return null
}

export async function saveProfileVersion(
  input: BrandProfileInput,
  extra?: { rolledBackFrom?: string },
  options?: { additionalEntries?: AtomicAppend[] | ((profile: BrandProfile) => AtomicAppend[]) },
): Promise<BrandProfile> {
  const parsed = ProfileInputSchema.parse(input)
  const payloadProblem = profilePayloadProblem(parsed)
  if (payloadProblem) throw new Error(`PROFILE_REFERENCE_FIREWALL:${payloadProblem}`)
  const referenceProblem = await profileReferenceProblem(parsed.style_refs ?? [])
  if (referenceProblem) throw new Error(`PROFILE_REFERENCE_FIREWALL:${referenceProblem}`)
  const version = `v-${Date.now()}-${randomUUID().slice(0, 8)}`
  const profile: BrandProfile = StoredProfileSchema.parse({
    ...parsed,
    profile_version: version,
    confirmedAt: new Date().toISOString(),
    ...(extra?.rolledBackFrom ? { rolledBackFrom: extra.rolledBackFrom } : {}),
  })
  const expectedEntityVersion = await getEntityVersion('profiles', profile.brand_id)
  const additionalEntries = typeof options?.additionalEntries === 'function'
    ? options.additionalEntries(profile)
    : (options?.additionalEntries ?? [])
  await appendRecordsAtomically([
    { collection: 'profiles', record: { id: version, ...profile }, guard: {
      entityKey: profile.brand_id,
      expectedEntityVersion,
      entityVersion: (expectedEntityVersion ?? 0) + 1,
    } },
    { collection: 'audit-events', record: {
      event: 'profile.version.confirmed',
      brandId: profile.brand_id,
      profileVersion: version,
      actor: profile.confirmedBy,
      source: profile.source,
    } },
    ...additionalEntries,
  ])
  await materializeProfileBestEffort(profile)
  return profile
}

export const saveName = 'mediaops.profile.save'
export const saveDescription =
  'Import and confirm core manual brand settings as a new immutable version. Free-form style/style_refs are rejected; style learning must use registered references and the form/propose/confirm workflow.'
export const saveInputSchema = PublicProfileImportSchema.shape

export async function saveHandler(args: z.input<typeof PublicProfileImportSchema>): Promise<Envelope> {
  const parsed = PublicProfileImportSchema.safeParse(args)
  if (!parsed.success) return err('INVALID_PROFILE', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
  const payloadProblem = profilePayloadProblem(parsed.data)
  if (payloadProblem) return err('PROFILE_REFERENCE_FIREWALL', payloadProblem)
  const previous = await loadProfile(parsed.data.brand_id)
  const profile = await saveProfileVersion(parsed.data)
  return ok({ brandId: profile.brand_id, profileVersion: profile.profile_version, updated: Boolean(previous) }, profileStorageWarnings())
}

export const getName = 'mediaops.profile.get'
export const getDescription = 'Fetch the current or a named immutable brand profile version.'
export const getInputSchema = { brandId: BrandIdSchema, version: ProfileVersionSchema.optional() }

export async function getHandler(args: { brandId: string; version?: string }): Promise<Envelope> {
  const profile = await loadProfile(args.brandId, args.version)
  if (!profile) return err('NOT_FOUND', `No profile ${args.brandId}${args.version ? `@${args.version}` : ''}.`, profileStorageWarnings())
  return ok(profile, profileStorageWarnings())
}

export const listName = 'mediaops.profile.list'
export const listDescription = 'List current brand profiles without crossing brand data scopes.'
export const listInputSchema = {}

export async function listHandler(): Promise<Envelope> {
  const currentByBrand = new Map<string, BrandProfile>()
  for (const profile of await databaseProfiles()) currentByBrand.set(profile.brand_id, profile)
  if (existsSync(profilesDir())) {
    const entries = await readdir(profilesDir(), { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory() || currentByBrand.has(entry.name)) continue
      const profile = await readProfile(currentPath(entry.name), entry.name)
      if (profile) currentByBrand.set(profile.brand_id, profile)
    }
  }
  const profiles = [...currentByBrand.values()].map((profile) => ({ brandId: profile.brand_id, name: profile.name, profileVersion: profile.profile_version }))
  return ok({ count: profiles.length, profiles }, profileStorageWarnings())
}

export const historyName = 'mediaops.profile.history'
export const historyDescription = 'List immutable profile versions for one brand.'
export const historyInputSchema = { brandId: BrandIdSchema }

export async function historyHandler(args: { brandId: string }): Promise<Envelope> {
  const byVersion = new Map((await databaseProfiles(args.brandId)).map((profile) => [profile.profile_version, profile]))
  const dir = versionsDir(args.brandId)
  if (existsSync(dir)) {
    const files = (await readdir(dir)).filter((file) => file.endsWith('.json'))
    for (const file of files) {
      const profile = await readProfile(join(dir, file), args.brandId)
      if (profile && !byVersion.has(profile.profile_version)) byVersion.set(profile.profile_version, profile)
    }
  }
  const versions = [...byVersion.values()]
  versions.sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt))
  return ok({ brandId: args.brandId, count: versions.length, versions }, profileStorageWarnings())
}

export const rollbackName = 'mediaops.profile.rollback'
export const rollbackDescription = 'Confirm a rollback by copying a historical profile into a new immutable version.'
export const rollbackInputSchema = { brandId: BrandIdSchema, targetVersion: ProfileVersionSchema, confirmedBy: z.string().min(1) }

export async function rollbackHandler(args: { brandId: string; targetVersion: string; confirmedBy: string }): Promise<Envelope> {
  const target = await loadProfile(args.brandId, args.targetVersion)
  if (!target) return err('NOT_FOUND', `No profile ${args.brandId}@${args.targetVersion}.`)
  const { profile_version: _version, confirmedAt: _at, rolledBackFrom: _rolled, ...base } = target
  const profile = await saveProfileVersion(
    { ...base, confirmedBy: args.confirmedBy, source: 'rollback' },
    { rolledBackFrom: args.targetVersion },
  )
  return ok({ brandId: args.brandId, profileVersion: profile.profile_version, rolledBackFrom: args.targetVersion }, profileStorageWarnings())
}
