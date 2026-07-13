import { lstat, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

export type Severity = "error" | "warning";

export type PresentationIssue = {
  severity: Severity;
  marketplacePath: string;
  entryName?: string | undefined;
  field?: string | undefined;
  message: string;
};

type RawGroup = {
  name?: unknown;
  displayName?: unknown;
  skills?: unknown;
};

type RawEntry = {
  name?: unknown;
  source?: unknown;
  version?: unknown;
  displayName?: unknown;
  shortDescription?: unknown;
  defaultPrompt?: unknown;
  brandColor?: unknown;
  composerIcon?: unknown;
  logo?: unknown;
  tier?: unknown;
  groups?: unknown;
};

type RawMarketplace = {
  plugins?: unknown;
};

type RawManifest = {
  name?: unknown;
  version?: unknown;
  skills?: unknown;
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const HAN_TEXT = /\p{Script=Han}/u;
const SAFE_RASTER_EXTENSION = /\.(?:png|jpe?g|webp)$/i;
const TEMPLATE_DESCRIPTION = /^this skill should be used when\b/i;
const MAX_RASTER_BYTES = 256 * 1024;
const MAX_PROMPT_CHARS = 128;
const MIN_SHORT_DESCRIPTION_CHARS = 18;
const MAX_SHORT_DESCRIPTION_CHARS = 72;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function characterLength(value: string): number {
  return Array.from(value).length;
}

function isContained(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function issue(
  marketplacePath: string,
  entryName: string | undefined,
  field: string,
  message: string,
): PresentationIssue {
  return { severity: "error", marketplacePath, entryName, field, message };
}

function hasRasterMagic(bytes: Uint8Array, extension: string): boolean {
  const ext = extension.toLowerCase();
  if (ext === ".png") {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  if (ext === ".jpg" || ext === ".jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  return (
    ext === ".webp" &&
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

async function validateRaster(
  trustedRoot: string,
  rawValue: unknown,
  marketplacePath: string,
  entryName: string | undefined,
  field: string,
): Promise<PresentationIssue[]> {
  const issues: PresentationIssue[] = [];
  const value = nonEmptyString(rawValue);
  if (value === null) {
    return [issue(marketplacePath, entryName, field, `${field} must be a non-empty relative raster path`)];
  }
  if (
    !value.startsWith("./") ||
    path.isAbsolute(value) ||
    /^[a-z]:[\\/]/i.test(value) ||
    /^[a-z][a-z0-9+.-]*:/i.test(value) ||
    value.includes("\0")
  ) {
    return [issue(marketplacePath, entryName, field, `${field} must start with "./" and must not be an absolute path or URL`)];
  }
  if (!SAFE_RASTER_EXTENSION.test(value)) {
    return [issue(marketplacePath, entryName, field, `${field} must reference a PNG, JPEG, or WebP raster`)];
  }

  const lexicalRoot = path.resolve(trustedRoot);
  const lexicalCandidate = path.resolve(lexicalRoot, value);
  if (!isContained(lexicalRoot, lexicalCandidate) || lexicalCandidate === lexicalRoot) {
    return [issue(marketplacePath, entryName, field, `${field} escapes its trusted plugin/skill root`)];
  }

  let canonicalRoot: string;
  let canonicalCandidate: string;
  try {
    canonicalRoot = await realpath(lexicalRoot);
    canonicalCandidate = await realpath(lexicalCandidate);
  } catch (error) {
    return [
      issue(
        marketplacePath,
        entryName,
        field,
        `${field} cannot be resolved: ${error instanceof Error ? error.message : String(error)}`,
      ),
    ];
  }
  if (!isContained(canonicalRoot, canonicalCandidate) || canonicalCandidate === canonicalRoot) {
    return [issue(marketplacePath, entryName, field, `${field} resolves outside its trusted plugin/skill root`)];
  }

  try {
    const linkStats = await lstat(lexicalCandidate);
    const fileStats = await stat(canonicalCandidate);
    if ((!linkStats.isFile() && !linkStats.isSymbolicLink()) || !fileStats.isFile()) {
      return [issue(marketplacePath, entryName, field, `${field} must resolve to a regular file`)];
    }
    if (fileStats.size <= 0 || fileStats.size > MAX_RASTER_BYTES) {
      return [
        issue(
          marketplacePath,
          entryName,
          field,
          `${field} must be between 1 and ${MAX_RASTER_BYTES} bytes`,
        ),
      ];
    }
    const bytes = await readFile(canonicalCandidate);
    if (!hasRasterMagic(bytes, path.extname(value))) {
      issues.push(issue(marketplacePath, entryName, field, `${field} content does not match its raster extension`));
    }
  } catch (error) {
    issues.push(
      issue(
        marketplacePath,
        entryName,
        field,
        `${field} cannot be read: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }
  return issues;
}

function parseFrontmatterScalar(text: string, key: string): string | null {
  if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) return null;
  const normalized = text.replace(/\r\n/g, "\n");
  const end = normalized.indexOf("\n---", 4);
  if (end < 0) return null;
  const frontmatter = normalized.slice(4, end);
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = frontmatter.match(new RegExp(`^${escaped}:\\s*(.*?)\\s*$`, "m"));
  if (!match) return null;
  const raw = match[1]?.trim() ?? "";
  if (raw.length < 2) return raw || null;
  if (raw.startsWith('"') && raw.endsWith('"')) {
    try {
      return JSON.parse(raw) as string;
    } catch {
      return raw.slice(1, -1);
    }
  }
  if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1).replace(/''/g, "'");
  return raw;
}

async function loadManifest(pluginRoot: string): Promise<RawManifest | null> {
  try {
    const text = await readFile(path.join(pluginRoot, ".crabcode-plugin", "plugin.json"), "utf8");
    const parsed = JSON.parse(text) as unknown;
    return isRecord(parsed) ? (parsed as RawManifest) : null;
  } catch {
    return null;
  }
}

function declaredSkillPaths(manifest: RawManifest): string[] {
  if (typeof manifest.skills === "string") return [manifest.skills];
  if (!Array.isArray(manifest.skills)) return [];
  return manifest.skills.filter((value): value is string => typeof value === "string");
}

async function validateSkillPresentation(
  pluginRoot: string,
  relativeSkillPath: string,
  marketplacePath: string,
  entryName: string | undefined,
): Promise<PresentationIssue[]> {
  const issues: PresentationIssue[] = [];
  const skillName = path.basename(relativeSkillPath.replace(/[\\/]+$/, ""));
  const fieldPrefix = `skills.${skillName}`;
  const skillRoot = path.resolve(pluginRoot, relativeSkillPath);
  if (!isContained(path.resolve(pluginRoot), skillRoot) || skillRoot === path.resolve(pluginRoot)) {
    return [issue(marketplacePath, entryName, fieldPrefix, `skill path "${relativeSkillPath}" escapes the plugin root`)];
  }

  let text: string;
  try {
    text = await readFile(path.join(skillRoot, "SKILL.md"), "utf8");
  } catch (error) {
    return [
      issue(
        marketplacePath,
        entryName,
        fieldPrefix,
        `cannot read ${relativeSkillPath}/SKILL.md: ${error instanceof Error ? error.message : String(error)}`,
      ),
    ];
  }

  const displayName = parseFrontmatterScalar(text, "name");
  if (displayName === null || !HAN_TEXT.test(displayName)) {
    issues.push(issue(marketplacePath, entryName, `${fieldPrefix}.name`, "workflow skill name must be a Chinese display label"));
  }
  const shortDescription = parseFrontmatterScalar(text, "short-description");
  if (shortDescription === null || !HAN_TEXT.test(shortDescription)) {
    issues.push(
      issue(
        marketplacePath,
        entryName,
        `${fieldPrefix}.short-description`,
        "workflow skill short-description must be present and contain Chinese text",
      ),
    );
  } else {
    const length = characterLength(shortDescription);
    if (length < MIN_SHORT_DESCRIPTION_CHARS || length > MAX_SHORT_DESCRIPTION_CHARS) {
      issues.push(
        issue(
          marketplacePath,
          entryName,
          `${fieldPrefix}.short-description`,
          `workflow skill short-description must be ${MIN_SHORT_DESCRIPTION_CHARS}-${MAX_SHORT_DESCRIPTION_CHARS} characters`,
        ),
      );
    }
    if (TEMPLATE_DESCRIPTION.test(shortDescription)) {
      issues.push(
        issue(
          marketplacePath,
          entryName,
          `${fieldPrefix}.short-description`,
          "workflow skill short-description must describe user value, not repeat a trigger template",
        ),
      );
    }
  }

  const brandColor = parseFrontmatterScalar(text, "brand-color");
  if (brandColor !== null && !HEX_COLOR.test(brandColor)) {
    issues.push(issue(marketplacePath, entryName, `${fieldPrefix}.brand-color`, "skill brand-color must be a six-digit hex color"));
  }
  const defaultPrompt = parseFrontmatterScalar(text, "default-prompt");
  if (defaultPrompt !== null && characterLength(defaultPrompt) > MAX_PROMPT_CHARS) {
    issues.push(issue(marketplacePath, entryName, `${fieldPrefix}.default-prompt`, `skill default-prompt must not exceed ${MAX_PROMPT_CHARS} characters`));
  }
  for (const iconField of ["icon-small", "icon-large"] as const) {
    const icon = parseFrontmatterScalar(text, iconField);
    if (icon !== null) {
      issues.push(...(await validateRaster(skillRoot, icon, marketplacePath, entryName, `${fieldPrefix}.${iconField}`)));
    }
  }
  return issues;
}

/**
 * Validate the official marketplace's user-facing workflow metadata.
 *
 * Plugin-level fields are required for every official workflow entry. Every
 * manifest-declared skill must provide Chinese presentation copy; its stable
 * invocation identity remains the skill directory basename. Raster fields are
 * optional, but any declared local asset is validated strictly. Runtime
 * compatibility for third-party packages is handled by CrabCode's UI fallback,
 * not by weakening this official marketplace quality gate.
 */
export async function validatePresentation(root: string): Promise<PresentationIssue[]> {
  const absRoot = path.resolve(root);
  const marketplacePath = path.join(absRoot, ".crabcode-plugin", "marketplace.json");
  let parsed: RawMarketplace;
  try {
    const text = await readFile(marketplacePath, "utf8");
    const value = JSON.parse(text) as unknown;
    if (!isRecord(value)) return [issue(marketplacePath, undefined, "marketplace", "marketplace must be an object")];
    parsed = value as RawMarketplace;
  } catch (error) {
    return [
      issue(
        marketplacePath,
        undefined,
        "marketplace",
        `cannot read marketplace presentation metadata: ${error instanceof Error ? error.message : String(error)}`,
      ),
    ];
  }
  if (!Array.isArray(parsed.plugins)) return [];

  const issues: PresentationIssue[] = [];
  for (const rawEntry of parsed.plugins) {
    if (!isRecord(rawEntry)) continue;
    const entry = rawEntry as RawEntry;
    if (entry.tier !== "workflow") continue;
    const entryName = nonEmptyString(entry.name) ?? undefined;

    const displayName = nonEmptyString(entry.displayName);
    if (displayName === null || !HAN_TEXT.test(displayName)) {
      issues.push(issue(marketplacePath, entryName, "displayName", "workflow displayName must contain Chinese text"));
    }
    const shortDescription = nonEmptyString(entry.shortDescription);
    if (shortDescription === null || !HAN_TEXT.test(shortDescription)) {
      issues.push(issue(marketplacePath, entryName, "shortDescription", "workflow shortDescription must contain Chinese text"));
    }
    if (!HEX_COLOR.test(nonEmptyString(entry.brandColor) ?? "")) {
      issues.push(issue(marketplacePath, entryName, "brandColor", "workflow brandColor must be a six-digit hex color"));
    }
    if (!Array.isArray(entry.defaultPrompt)) {
      issues.push(issue(marketplacePath, entryName, "defaultPrompt", "workflow defaultPrompt must be an array"));
    } else {
      if (entry.defaultPrompt.length > 3) {
        issues.push(issue(marketplacePath, entryName, "defaultPrompt", "workflow defaultPrompt must contain at most 3 prompts"));
      }
      for (const [index, prompt] of entry.defaultPrompt.entries()) {
        const normalized = nonEmptyString(prompt);
        if (normalized === null || characterLength(normalized) > MAX_PROMPT_CHARS) {
          issues.push(
            issue(
              marketplacePath,
              entryName,
              `defaultPrompt[${index}]`,
              `workflow prompt must be non-empty and at most ${MAX_PROMPT_CHARS} characters`,
            ),
          );
        }
      }
    }

    const source = nonEmptyString(entry.source);
    if (source === null || !source.startsWith("./")) continue;
    const pluginRoot = path.resolve(absRoot, source);
    if (!isContained(absRoot, pluginRoot)) continue;
    const manifest = await loadManifest(pluginRoot);
    if (manifest === null) continue;
    const entryVersion = nonEmptyString(entry.version);
    const manifestVersion = nonEmptyString(manifest.version);
    if (entryVersion === null || manifestVersion === null || entryVersion !== manifestVersion) {
      issues.push(
        issue(
          marketplacePath,
          entryName,
          "version",
          `marketplace version "${entryVersion ?? "<missing>"}" must equal plugin manifest version "${manifestVersion ?? "<missing>"}"`,
        ),
      );
    }

    for (const iconField of ["composerIcon", "logo"] as const) {
      const icon = entry[iconField];
      if (icon !== undefined) {
        issues.push(...(await validateRaster(pluginRoot, icon, marketplacePath, entryName, iconField)));
      }
    }

    const skillPaths = declaredSkillPaths(manifest);
    const skillsByName = new Map<string, string>();
    for (const skillPath of skillPaths) {
      const stableName = path.basename(skillPath.replace(/[\\/]+$/, ""));
      if (skillsByName.has(stableName)) {
        issues.push(issue(marketplacePath, entryName, "skills", `manifest declares duplicate skill basename "${stableName}"`));
      } else {
        skillsByName.set(stableName, skillPath);
      }
    }
    if (Array.isArray(entry.groups)) {
      for (const [groupIndex, rawGroup] of entry.groups.entries()) {
        if (!isRecord(rawGroup)) continue;
        const group = rawGroup as RawGroup;
        if (!Array.isArray(group.skills)) continue;
        for (const rawSkill of group.skills) {
          if (typeof rawSkill !== "string") continue;
          if (!skillsByName.has(rawSkill)) {
            issues.push(
              issue(
                marketplacePath,
                entryName,
                `groups[${groupIndex}].skills`,
                `group references undeclared skill "${rawSkill}"`,
              ),
            );
          }
        }
      }
    }
    for (const skillPath of skillPaths) {
      issues.push(...(await validateSkillPresentation(pluginRoot, skillPath, marketplacePath, entryName)));
    }
  }
  return issues;
}

export function formatPresentationIssues(issues: PresentationIssue[], root: string): string {
  return issues
    .map((entry) => {
      const rel = path.relative(root, entry.marketplacePath);
      const plugin = entry.entryName ? ` (${entry.entryName})` : "";
      const field = entry.field ? ` [${entry.field}]` : "";
      return `${entry.severity.toUpperCase()} ${rel}${plugin}${field}: ${entry.message}`;
    })
    .join("\n");
}

export const PRESENTATION_MAX_RASTER_BYTES = MAX_RASTER_BYTES;
