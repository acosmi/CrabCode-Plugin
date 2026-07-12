import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { BrandIdSchema } from '../domain.ts'
import { err, ok, type Envelope } from '../envelope.ts'
import { appendRecord, dataDir, ensureDir, storageWarnings } from '../storage.ts'

const profileShape = {
  brand_id: BrandIdSchema,
  name: z.string().min(1),
  persona: z.object({ identity: z.string().min(1), domain: z.array(z.string()).optional(), stance: z.string().optional() }).passthrough(),
  voice: z.object({ tone: z.string().min(1), person: z.string().optional(), formality: z.string().optional(), emoji: z.string().optional() }).passthrough(),
  audience: z.object({ segments: z.array(z.string()).min(1), pain_points: z.array(z.string()).optional(), reading_context: z.string().optional() }).passthrough(),
  columns: z.array(z.object({ name: z.string().min(1), cadence: z.string().optional() }).passthrough()),
  platforms: z.array(z.object({ platform: z.string().min(1), columns: z.array(z.string()).optional() }).passthrough()),
  banned_words: z.array(z.string()),
  style_refs: z.array(z.record(z.unknown())).optional(),
  style: z.record(z.unknown()).optional(),
  compliance: z.object({ ai_label_text: z.string().min(1), avoid_domains: z.array(z.string()).optional() }).passthrough(),
}

const ProfileInputSchema = z.object({
  ...profileShape,
  confirmedBy: z.string().min(1),
  source: z.enum(['confirmed-form', 'manual-import', 'rollback']).default('manual-import'),
  sourceFormId: z.string().uuid().optional(),
})

const StoredProfileSchema = z.object({
  ...profileShape,
  profile_version: z.string().min(1),
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

function versionPath(brandId: string, version: string): string {
  return join(versionsDir(brandId), `${version}.json`)
}

async function readProfile(path: string): Promise<BrandProfile | null> {
  if (!existsSync(path)) return null
  try {
    const parsed = StoredProfileSchema.safeParse(JSON.parse(await readFile(path, 'utf8')))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export async function loadProfile(brandId: string, version?: string): Promise<BrandProfile | null> {
  if (!BrandIdSchema.safeParse(brandId).success) return null
  return readProfile(version ? versionPath(brandId, version) : currentPath(brandId))
}

export async function saveProfileVersion(
  input: BrandProfileInput,
  extra?: { rolledBackFrom?: string },
): Promise<BrandProfile> {
  const parsed = ProfileInputSchema.parse(input)
  const version = `v-${Date.now()}-${randomUUID().slice(0, 8)}`
  const profile: BrandProfile = StoredProfileSchema.parse({
    ...parsed,
    profile_version: version,
    confirmedAt: new Date().toISOString(),
    ...(extra?.rolledBackFrom ? { rolledBackFrom: extra.rolledBackFrom } : {}),
  })
  await ensureDir(versionsDir(profile.brand_id))
  const serialized = JSON.stringify(profile, null, 2) + '\n'
  await writeFile(versionPath(profile.brand_id, version), serialized, 'utf8')
  await writeFile(currentPath(profile.brand_id), serialized, 'utf8')
  await appendRecord('audit-events', {
    event: 'profile.version.confirmed',
    brandId: profile.brand_id,
    profileVersion: version,
    actor: profile.confirmedBy,
    source: profile.source,
  })
  return profile
}

export const saveName = 'mediaops.profile.save'
export const saveDescription =
  'Import and confirm a complete brand profile as a new immutable version. Never overwrites version history; confirmedBy is required.'
export const saveInputSchema = ProfileInputSchema.shape

export async function saveHandler(args: BrandProfileInput): Promise<Envelope> {
  const parsed = ProfileInputSchema.safeParse(args)
  if (!parsed.success) return err('INVALID_PROFILE', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
  const previous = await loadProfile(parsed.data.brand_id)
  const profile = await saveProfileVersion(parsed.data)
  return ok({ brandId: profile.brand_id, profileVersion: profile.profile_version, updated: Boolean(previous) }, storageWarnings())
}

export const getName = 'mediaops.profile.get'
export const getDescription = 'Fetch the current or a named immutable brand profile version.'
export const getInputSchema = { brandId: BrandIdSchema, version: z.string().optional() }

export async function getHandler(args: { brandId: string; version?: string }): Promise<Envelope> {
  const profile = await loadProfile(args.brandId, args.version)
  if (!profile) return err('NOT_FOUND', `No profile ${args.brandId}${args.version ? `@${args.version}` : ''}.`, storageWarnings())
  return ok(profile, storageWarnings())
}

export const listName = 'mediaops.profile.list'
export const listDescription = 'List current brand profiles without crossing brand data scopes.'
export const listInputSchema = {}

export async function listHandler(): Promise<Envelope> {
  if (!existsSync(profilesDir())) return ok({ count: 0, profiles: [] }, storageWarnings())
  const entries = await readdir(profilesDir(), { withFileTypes: true })
  const profiles: { brandId: string; name: string; profileVersion: string }[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const profile = await loadProfile(entry.name)
    if (profile) profiles.push({ brandId: profile.brand_id, name: profile.name, profileVersion: profile.profile_version })
  }
  return ok({ count: profiles.length, profiles }, storageWarnings())
}

export const historyName = 'mediaops.profile.history'
export const historyDescription = 'List immutable profile versions for one brand.'
export const historyInputSchema = { brandId: BrandIdSchema }

export async function historyHandler(args: { brandId: string }): Promise<Envelope> {
  const dir = versionsDir(args.brandId)
  if (!existsSync(dir)) return ok({ brandId: args.brandId, count: 0, versions: [] }, storageWarnings())
  const files = (await readdir(dir)).filter((file) => file.endsWith('.json'))
  const versions: BrandProfile[] = []
  for (const file of files) {
    const profile = await readProfile(join(dir, file))
    if (profile) versions.push(profile)
  }
  versions.sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt))
  return ok({ brandId: args.brandId, count: versions.length, versions }, storageWarnings())
}

export const rollbackName = 'mediaops.profile.rollback'
export const rollbackDescription = 'Confirm a rollback by copying a historical profile into a new immutable version.'
export const rollbackInputSchema = { brandId: BrandIdSchema, targetVersion: z.string().min(1), confirmedBy: z.string().min(1) }

export async function rollbackHandler(args: { brandId: string; targetVersion: string; confirmedBy: string }): Promise<Envelope> {
  const target = await loadProfile(args.brandId, args.targetVersion)
  if (!target) return err('NOT_FOUND', `No profile ${args.brandId}@${args.targetVersion}.`)
  const { profile_version: _version, confirmedAt: _at, rolledBackFrom: _rolled, ...base } = target
  const profile = await saveProfileVersion(
    { ...base, confirmedBy: args.confirmedBy, source: 'rollback' },
    { rolledBackFrom: args.targetVersion },
  )
  return ok({ brandId: args.brandId, profileVersion: profile.profile_version, rolledBackFrom: args.targetVersion }, storageWarnings())
}
