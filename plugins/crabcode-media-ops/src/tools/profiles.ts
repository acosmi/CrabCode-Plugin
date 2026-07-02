import { z } from 'zod'
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { ok, err, type Envelope } from '../envelope.ts'
import { dataDir, ensureDir, storageWarnings } from '../storage.ts'

// Brand profiles (references/brand-profile-schema.md) persisted as one JSON file
// per brand under <data>/profiles/. JSON instead of YAML keeps the server
// dependency-free; the schema doc is the field-level source of truth.

/** brand_id doubles as the file name — restrict to a safe slug. */
const BRAND_ID = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,63}$/, 'brand_id must be a lowercase slug (a-z, 0-9, hyphens)')

const profileShape = {
  brand_id: BRAND_ID,
  name: z.string().min(1),
  persona: z
    .object({ identity: z.string().min(1), domain: z.array(z.string()).optional(), stance: z.string().optional() })
    .passthrough(),
  voice: z
    .object({ tone: z.string().min(1), person: z.string().optional(), formality: z.string().optional(), emoji: z.string().optional() })
    .passthrough(),
  audience: z
    .object({ segments: z.array(z.string()), pain_points: z.array(z.string()).optional(), reading_context: z.string().optional() })
    .passthrough(),
  columns: z.array(z.object({ name: z.string().min(1), cadence: z.string().optional() }).passthrough()),
  platforms: z.array(z.object({ platform: z.string().min(1), columns: z.array(z.string()).optional() }).passthrough()),
  banned_words: z.array(z.string()),
  style_refs: z.array(z.record(z.unknown())).optional(),
  compliance: z
    .object({ ai_label_text: z.string().min(1), avoid_domains: z.array(z.string()).optional() })
    .passthrough(),
}

const ProfileSchema = z.object(profileShape)

export type BrandProfile = z.infer<typeof ProfileSchema>

function profilesDir(): string {
  return join(dataDir(), 'profiles')
}

function profilePath(brandId: string): string {
  return join(profilesDir(), `${brandId}.json`)
}

/** Load a stored profile, validating it against the schema. Returns null when absent. */
export async function loadProfile(brandId: string): Promise<BrandProfile | null> {
  if (!BRAND_ID.safeParse(brandId).success) return null
  const path = profilePath(brandId)
  if (!existsSync(path)) return null
  const raw = await readFile(path, 'utf8')
  const parsed = ProfileSchema.safeParse(JSON.parse(raw))
  return parsed.success ? parsed.data : null
}

// ---- mediaops.profile.save ----------------------------------------------------

export const saveName = 'mediaops.profile.save'
export const saveDescription =
  'Validate and persist a brand profile (persona, voice, audience, columns, platforms, banned_words, compliance) as JSON under <data>/profiles/<brand_id>.json. Overwrites any existing profile with the same brand_id.'

export const saveInputSchema = profileShape

export async function saveHandler(args: BrandProfile): Promise<Envelope> {
  const parsed = ProfileSchema.safeParse(args)
  if (!parsed.success) {
    return err('invalid_profile', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
  }
  await ensureDir(profilesDir())
  const path = profilePath(parsed.data.brand_id)
  const existed = existsSync(path)
  await writeFile(path, JSON.stringify(parsed.data, null, 2) + '\n', 'utf8')
  return ok({ brandId: parsed.data.brand_id, path, updated: existed }, storageWarnings())
}

// ---- mediaops.profile.get -------------------------------------------------------

export const getName = 'mediaops.profile.get'
export const getDescription = 'Fetch a stored brand profile by brand_id.'

export const getInputSchema = {
  brandId: BRAND_ID,
}

export async function getHandler(args: { brandId: string }): Promise<Envelope> {
  const profile = await loadProfile(args.brandId)
  if (!profile) return err('not_found', `no valid profile for brand '${args.brandId}'`, storageWarnings())
  return ok(profile, storageWarnings())
}

// ---- mediaops.profile.list ------------------------------------------------------

export const listName = 'mediaops.profile.list'
export const listDescription = 'List stored brand profiles (brand_id + display name).'

export const listInputSchema = {}

export async function listHandler(): Promise<Envelope> {
  const dir = profilesDir()
  if (!existsSync(dir)) return ok({ count: 0, profiles: [] }, storageWarnings())
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json'))
  const profiles: { brandId: string; name: string }[] = []
  for (const file of files) {
    const brandId = file.slice(0, -'.json'.length)
    const profile = await loadProfile(brandId)
    if (profile) profiles.push({ brandId: profile.brand_id, name: profile.name })
  }
  return ok({ count: profiles.length, profiles }, storageWarnings())
}
