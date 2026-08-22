/**
 * CrabCopyright-CN deterministic source-material adapter.
 *
 * The parser/discovery/rendering primitives under vendor/codesucker-core are an
 * unmodified Apache-2.0 snapshot of CodeSucker v0.4.5. This file is the local
 * adaptation layer: path containment, provenance, stable page/line maps,
 * deterministic DOCX normalization, manifest v2 updates and CLI behavior.
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import chardet from 'chardet';
import iconv from 'iconv-lite';
import JSZip from 'jszip';
import {
  DEFAULT_EXCLUDES,
  DEFAULT_EXTENSIONS,
  annotate,
  audit,
  discover,
  extractAttributions,
  renderDocx,
  sortFiles,
  type AuditItem,
  type CleanOptions,
  type CleanedFile,
  type FileEntry,
  type Page,
  type ProjectConfig,
  type Selection,
} from '../vendor/codesucker-core/src/index.ts';

const PLUGIN_VERSION = '0.3.0';
const MANIFEST_SCHEMA_VERSION = 2;
const RULES_VERSION = '2026.03.15.1';
const UPSTREAM_VERSION = '0.4.5';
const UPSTREAM_COMMIT = '2e39375cf6891b9d958c277f1c6eb3b5104814d9';
const LINES_PER_PAGE = 50;
const MAX_PAGES = 60;
const MAX_FILES = 20_000;
const MAX_TOTAL_BYTES = 128 * 1024 * 1024;
const FIXED_ZIP_DATE = new Date('2000-01-01T00:00:00.000Z');

type SortMode = 'entry' | 'mtime' | 'manual';

export interface SourceCoreConfig {
  root: string;
  sourceDirs?: string[];
  selectedFiles?: string[];
  title: string;
  owner?: string;
  foundedDate?: string;
  extensions?: string[];
  excludes?: string[];
  sortMode?: SortMode;
  clean?: Partial<CleanOptions>;
  outputDir: string;
  baseName?: string;
  allowGenerated?: boolean;
}

interface SourceLineRecord {
  text: string;
  relPath: string;
  sourceLine: number;
  outputPart: number;
  masked: boolean;
}

interface ExcludedFile {
  relPath: string;
  reason: string;
}

interface PipelineResult {
  status: 'pass' | 'warn' | 'fail';
  rulesVersion: string;
  pluginVersion: string;
  upstream: { version: string; commit: string };
  stats: {
    discoveredFiles: number;
    includedFiles: number;
    excludedFiles: number;
    rawLines: number;
    effectiveLines: number;
    pickedLines: number;
    pages: number;
    truncated: boolean;
    maskedLines: number;
  };
  files: {
    sourceText: string;
    sourceDocx: string;
    selection: string;
    audit: string;
    lineMap: string;
    pages: string;
  };
  hashes: Record<string, string>;
  auditItems: AuditItem[];
  excluded: ExcludedFile[];
}

function fail(message: string): never {
  throw new Error(message);
}

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} 必须是对象`);
  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim() === '')) fail(`${label} 必须是非空字符串`);
  return value;
}

function asStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) fail(`${label} 必须是字符串数组`);
  return [...new Set(value as string[])];
}

function toPosix(value: string): string {
  return value.split(path.sep).join('/');
}

function normalizeRelative(value: string, label: string): string {
  const normalized = toPosix(value.trim().replace(/\\/g, '/')).replace(/^\.\//, '');
  if (!normalized || path.posix.isAbsolute(normalized) || /^[A-Za-z]:\//.test(normalized)) {
    fail(`${label} 必须是非空相对路径: ${value}`);
  }
  const segments = normalized.split('/');
  if (segments.includes('..') || segments.includes('')) fail(`${label} 不得包含 .. 或空路径段: ${value}`);
  return normalized;
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function ensureDirectory(pathValue: string, label: string): string {
  const absolute = path.resolve(pathValue);
  const stat = fs.lstatSync(absolute);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail(`${label} 必须是非符号链接目录: ${absolute}`);
  return fs.realpathSync(absolute);
}

function ensureOutputFence(outputDir: string): string {
  const absolute = path.resolve(outputDir);
  let cursor = absolute;
  const missing: string[] = [];
  while (!fs.existsSync(cursor)) {
    missing.push(path.basename(cursor));
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  const canonicalAncestor = fs.existsSync(cursor) ? fs.realpathSync(cursor) : cursor;
  const canonical = path.join(canonicalAncestor, ...missing.reverse());
  if (fs.existsSync(canonical) && fs.lstatSync(canonical).isSymbolicLink()) fail(`输出目录不得是符号链接: ${canonical}`);
  return canonical;
}

function sha256(data: Uint8Array | string): string {
  return createHash('sha256').update(data).digest('hex');
}

function sha256File(file: string): string {
  return sha256(fs.readFileSync(file));
}

function canonicalJson(value: unknown): string {
  const normalize = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(normalize);
    if (entry && typeof entry === 'object') {
      return Object.fromEntries(Object.entries(entry as Record<string, unknown>)
        .sort(([a], [b]) => Buffer.from(a).compare(Buffer.from(b)))
        .map(([key, child]) => [key, normalize(child)]));
    }
    return entry;
  };
  return `${JSON.stringify(normalize(value), null, 2)}\n`;
}

function atomicWrite(file: string, bytes: Uint8Array | string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) fail(`拒绝覆盖符号链接: ${file}`);
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${createHash('sha256').update(file).digest('hex').slice(0, 8)}.tmp`);
  const fd = fs.openSync(temp, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, bytes);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fs.renameSync(temp, file);
  } catch (error) {
    try { fs.closeSync(fd); } catch { /* already closed */ }
    try { fs.unlinkSync(temp); } catch { /* best effort */ }
    throw error;
  }
}

function readJson(file: string): unknown {
  if (fs.lstatSync(file).isSymbolicLink()) fail(`拒绝读取符号链接 JSON: ${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function cjkCount(value: string): number {
  return [...value].filter((char) => /[\u3400-\u9fff]/u.test(char)).length;
}

function readSourceStable(file: string): { text: string; encoding: string } {
  const bytes = fs.readFileSync(file);
  if (bytes.includes(0)) fail(`二进制文件不得作为源码读取: ${file}`);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: bytes.subarray(3).toString('utf8'), encoding: 'UTF-8-BOM' };
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { text, encoding: 'UTF-8' };
  } catch { /* continue with legacy encodings */ }

  const detected = String(chardet.detect(bytes) ?? '').toUpperCase();
  const candidates = [...new Set([detected, 'GB18030', 'BIG5', 'SHIFT_JIS'].filter((entry) => entry && iconv.encodingExists(entry)))];
  const decoded = candidates.map((encoding) => ({ encoding, text: iconv.decode(bytes, encoding) }));
  const gb = decoded.find((entry) => entry.encoding === 'GB18030');
  const detectedValue = decoded.find((entry) => entry.encoding === detected);
  const detectedIsSingleByte = /(?:ISO-8859|WINDOWS-12|MACROMAN|ASCII)/.test(detected);
  if (gb && detectedValue && detectedIsSingleByte && cjkCount(gb.text) >= 2 && cjkCount(gb.text) > cjkCount(detectedValue.text)) {
    return gb;
  }
  const best = decoded.sort((a, b) => {
    const badA = (a.text.match(/\uFFFD/g) ?? []).length;
    const badB = (b.text.match(/\uFFFD/g) ?? []).length;
    if (badA !== badB) return badA - badB;
    return cjkCount(b.text) - cjkCount(a.text);
  })[0];
  if (!best) fail(`无法识别源码编码: ${file}`);
  return best;
}

function buildConfigFromManifest(manifestPath: string, outputOverride?: string): { config: SourceCoreConfig; manifest: Record<string, unknown> } {
  const manifest = asObject(readJson(manifestPath), 'manifest');
  if (manifest.schema_version !== MANIFEST_SCHEMA_VERSION) fail('manifest.schema_version 必须为 2；请先运行 migrate_manifest.py');
  if (manifest.plugin_version !== PLUGIN_VERSION) fail(`manifest.plugin_version 必须为 ${PLUGIN_VERSION}`);
  if (manifest.rules_version !== RULES_VERSION) fail(`manifest.rules_version 必须为 ${RULES_VERSION}`);

  const ai = asObject(manifest.ai_assistance, 'manifest.ai_assistance');
  const triFields = ['code', 'manual', 'application_materials'] as const;
  for (const field of triFields) {
    if (ai[field] !== 'no') fail(`ai_assistance.${field} 必须为 no；yes/unknown 只能做只读复核，不能生成提交材料`);
  }
  if (ai.current_workflow_used_ai !== false) fail('current_workflow_used_ai 必须为 false；AI 辅助材料只能走 review-only 流程');
  if (ai.applicant_acknowledged !== true) fail('applicant_acknowledged 必须为 true');

  const software = asObject(manifest.software, 'manifest.software');
  const applicant = asObject(manifest.applicant, 'manifest.applicant');
  const dates = asObject(manifest.dates, 'manifest.dates');
  const source = asObject(manifest.source, 'manifest.source');
  const manifestDir = path.dirname(path.resolve(manifestPath));
  const rootValue = asString(source.root, 'manifest.source.root');
  const root = path.resolve(manifestDir, rootValue);
  const sourceDirs = asStringArray(source.dirs ?? [], 'manifest.source.dirs');
  const selectedFiles = asStringArray(source.include_files ?? [], 'manifest.source.include_files');
  if (source.scope_confirmed !== true) fail('manifest.source.scope_confirmed 必须由申请人确认为 true');
  const processing = asObject(source.processing, 'manifest.source.processing');
  const outputCandidate = outputOverride
    ? path.resolve(manifestDir, outputOverride)
    : path.join(manifestDir, '中间态');
  const outputDir = ensureOutputFence(outputCandidate);
  const canonicalManifestDir = fs.realpathSync(manifestDir);
  if (!isInside(canonicalManifestDir, outputDir)) {
    fail('manifest 模式的输出目录必须位于申请目录内');
  }

  return {
    manifest,
    config: {
      root,
      sourceDirs,
      selectedFiles: selectedFiles.length ? selectedFiles : undefined,
      title: `${asString(software.full_name, 'software.full_name')} ${asString(software.version, 'software.version')}`,
      owner: typeof applicant.copyright_owner === 'string' ? applicant.copyright_owner : undefined,
      foundedDate: typeof dates.company_established === 'string' && dates.company_established ? dates.company_established : undefined,
      outputDir,
      baseName: '源代码材料',
      clean: {
        removeComments: processing.remove_comments === true,
        removeBlankLines: processing.remove_blank_lines === true,
        maskSensitive: processing.mask_sensitive !== false,
        wrapLongLines: processing.wrap_long_lines === true,
        maxLineWidth: typeof processing.max_line_width === 'number' ? processing.max_line_width : 78,
        tabWidth: typeof processing.tab_width === 'number' ? processing.tab_width : 4,
      },
    },
  };
}

function normalizeConfig(input: unknown): SourceCoreConfig {
  const value = asObject(input, 'config');
  const root = asString(value.root, 'config.root');
  const outputDir = asString(value.outputDir, 'config.outputDir');
  return {
    root,
    outputDir,
    title: asString(value.title, 'config.title'),
    owner: typeof value.owner === 'string' ? value.owner : undefined,
    foundedDate: typeof value.foundedDate === 'string' ? value.foundedDate : undefined,
    sourceDirs: value.sourceDirs === undefined ? undefined : asStringArray(value.sourceDirs, 'config.sourceDirs'),
    selectedFiles: value.selectedFiles === undefined ? undefined : asStringArray(value.selectedFiles, 'config.selectedFiles'),
    extensions: value.extensions === undefined ? undefined : asStringArray(value.extensions, 'config.extensions'),
    excludes: value.excludes === undefined ? undefined : asStringArray(value.excludes, 'config.excludes'),
    sortMode: ['entry', 'mtime', 'manual'].includes(String(value.sortMode)) ? value.sortMode as SortMode : 'entry',
    clean: value.clean && typeof value.clean === 'object' ? value.clean as Partial<CleanOptions> : undefined,
    baseName: typeof value.baseName === 'string' && value.baseName ? value.baseName : '源代码材料',
    allowGenerated: value.allowGenerated === true,
  };
}

function sourcePrefixes(values: string[] | undefined): string[] {
  return (values ?? []).map((value, index) => {
    if (value.trim() === '.') return '';
    return normalizeRelative(value, `sourceDirs[${index}]`).replace(/\/$/, '');
  });
}

function isUnderPrefix(relPath: string, prefixes: string[]): boolean {
  if (!prefixes.length) return true;
  return prefixes.some((prefix) => prefix === '' || relPath === prefix || relPath.startsWith(`${prefix}/`));
}

function assertNoSymlinks(root: string, prefixes: string[], excludes: string[]): void {
  const simpleExcluded = new Set(
    excludes.filter((value) => !/[*?\[\]{}]/.test(value) && !value.includes('/')),
  );
  let visited = 0;
  const starts = prefixes.length ? prefixes : [''];
  for (const prefix of starts) {
    const start = path.resolve(root, prefix || '.');
    if (!isInside(root, start)) fail(`sourceDirs 越出源码根: ${prefix}`);
    const startStat = fs.lstatSync(start);
    if (startStat.isSymbolicLink() || !startStat.isDirectory()) fail(`sourceDirs 必须是非符号链接目录: ${prefix}`);
    const stack = [start];
    while (stack.length) {
      const current = stack.pop()!;
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        visited++;
        if (visited > MAX_FILES * 5) fail(`源码目录条目超过安全遍历上限 ${MAX_FILES * 5}`);
        const candidate = path.join(current, entry.name);
        if (entry.isSymbolicLink()) fail(`源码范围含符号链接，拒绝扫描: ${toPosix(path.relative(root, candidate))}`);
        if (entry.isDirectory() && !simpleExcluded.has(entry.name) && !entry.name.startsWith('.')) stack.push(candidate);
      }
    }
  }
}

const GENERATED_RE = /(?:@generated|generated\s+by|auto[- ]generated|do\s+not\s+edit|此文件由.+自动生成)/i;
const SPDX_RE = /SPDX-License-Identifier\s*:\s*([^\s*]+)/i;

function redactEvidence(value: string): string {
  return value
    .replace(/((?:api[_-]?key|secret|token|passwd|password|access[_-]?key)\s*[:=]\s*["'])([^"']+)(["'])/gi, '$1[REDACTED]$3')
    .replace(/\b(?:sk|pk|ghp|gho|glpat|AKIA|ASIA)[-_][A-Za-z0-9_-]{8,}\b/g, '[REDACTED_TOKEN]')
    .replace(/\b(?:10|192\.168|172\.(?:1[6-9]|2\d|3[01]))(?:\.\d{1,3}){2,3}\b/g, '10.0.*.*')
    .replace(/\b1[3-9]\d{9}\b/g, '[REDACTED_PHONE]');
}

function sanitizeAuditItem(item: AuditItem): AuditItem {
  return {
    ...item,
    detail: redactEvidence(item.detail),
    evidence: item.evidence?.map((entry) => ({ ...entry, detail: redactEvidence(entry.detail) })),
  };
}

function prepareEntries(config: SourceCoreConfig): { root: string; entries: FileEntry[]; excluded: ExcludedFile[] } {
  const root = ensureDirectory(config.root, '源码根目录');
  const prefixes = sourcePrefixes(config.sourceDirs);
  const exclusions = [...DEFAULT_EXCLUDES, 'outputs', 'generated', 'third_party', 'third-party', ...(config.excludes ?? [])];
  assertNoSymlinks(root, prefixes, exclusions);
  const discovered = discover(root, config.extensions ?? DEFAULT_EXTENSIONS, exclusions);
  if (discovered.length > MAX_FILES) fail(`源码文件数 ${discovered.length} 超过上限 ${MAX_FILES}`);
  const selected = new Set((config.selectedFiles ?? []).map((value, index) => normalizeRelative(value, `selectedFiles[${index}]`)));
  const excluded: ExcludedFile[] = [];
  let totalBytes = 0;
  const accepted: FileEntry[] = [];

  for (const entry of discovered) {
    const relPath = toPosix(entry.relPath);
    if (!isUnderPrefix(relPath, prefixes)) continue;
    if (selected.size && !selected.has(relPath)) continue;
    const real = fs.realpathSync(entry.path);
    if (!isInside(root, real)) fail(`源码文件经符号链接越出根目录: ${relPath} -> ${real}`);
    const preview = readSourceStable(entry.path).text.slice(0, 16_384);
    if (!config.allowGenerated && GENERATED_RE.test(preview)) {
      excluded.push({ relPath, reason: 'generated-marker' });
      continue;
    }
    totalBytes += entry.sizeBytes;
    if (totalBytes > MAX_TOTAL_BYTES) fail(`源码总字节超过上限 ${MAX_TOTAL_BYTES}`);
    accepted.push({ ...entry, relPath, path: real });
  }

  if (selected.size) {
    const found = new Set(accepted.map((entry) => entry.relPath));
    const missing = [...selected].filter((value) => !found.has(value));
    if (missing.length) fail(`显式 selectedFiles 不存在、被排除或越界: ${missing.join(', ')}`);
  }
  const ordered = config.sortMode === 'manual' ? accepted : sortFiles(accepted, config.sortMode ?? 'entry');
  if (!ordered.length) fail('未找到可用于材料的合格源码文件');
  return { root, entries: ordered, excluded };
}

function buildCleanOptions(config: SourceCoreConfig): CleanOptions {
  return {
    removeComments: config.clean?.removeComments ?? true,
    removeBlankLines: config.clean?.removeBlankLines ?? true,
    maskSensitive: config.clean?.maskSensitive ?? true,
    wrapLongLines: config.clean?.wrapLongLines ?? true,
    maxLineWidth: config.clean?.maxLineWidth ?? 78,
    tabWidth: config.clean?.tabWidth ?? 4,
  };
}

function cleanWithMap(entries: FileEntry[], options: CleanOptions): { cleaned: CleanedFile[]; records: SourceLineRecord[] } {
  const cleaned: CleanedFile[] = [];
  const records: SourceLineRecord[] = [];
  for (const original of entries) {
    const { text, encoding } = readSourceStable(original.path);
    const entry = { ...original, encoding };
    const annotated = annotate(text, entry.ext, options);
    let removedComments = 0;
    let removedBlanks = 0;
    let maskedCount = 0;
    const lines: string[] = [];
    annotated.forEach((line, lineIndex) => {
      if (line.kind === 'comment') removedComments++;
      if (line.kind === 'blank' && line.out.length === 0) removedBlanks++;
      if (line.masked) maskedCount++;
      line.out.forEach((output, outputPart) => {
        lines.push(output);
        records.push({
          text: output,
          relPath: entry.relPath,
          sourceLine: lineIndex + 1,
          outputPart: outputPart + 1,
          masked: line.masked,
        });
      });
    });
    cleaned.push({
      entry,
      lines,
      attributions: extractAttributions(text, entry.relPath, entry.ext),
      removedComments,
      removedBlanks,
      maskedCount,
    });
  }
  return { cleaned, records };
}

function selectRecords(records: SourceLineRecord[]): { records: SourceLineRecord[]; pages: Page[]; selection: Selection } {
  const limit = LINES_PER_PAGE * MAX_PAGES;
  const picked = records.length <= limit
    ? records
    : [...records.slice(0, limit / 2), ...records.slice(records.length - limit / 2)];
  const pages: Page[] = [];
  for (let index = 0; index < picked.length; index += LINES_PER_PAGE) {
    const chunk = picked.slice(index, index + LINES_PER_PAGE);
    pages.push({
      no: pages.length + 1,
      lines: chunk.map((line) => line.text),
      startFile: chunk[0].relPath,
      endFile: chunk[chunk.length - 1].relPath,
    });
  }
  const uniqueFiles = [...new Set(picked.map((line) => line.relPath))];
  const truncated = records.length > limit;
  return {
    records: picked,
    pages,
    selection: {
      pages,
      totalLines: records.length,
      pickedLines: picked.length,
      truncated,
      selectedRelPaths: uniqueFiles,
      splitAfterPage: truncated ? 30 : null,
      frontEndFile: truncated ? picked[limit / 2 - 1].relPath : null,
      backStartFile: truncated ? picked[limit / 2].relPath : null,
    },
  };
}

function addLocalAudit(
  base: AuditItem[], cleaned: CleanedFile[], excluded: ExcludedFile[], selection: Selection,
): AuditItem[] {
  const items = base.map((item) => item.name === '首页为模块开头、末页为模块结尾'
    ? { ...item, status: 'warn' as const, detail: `${item.detail}；程序仅证明文件边界，仍须用户确认语义边界。` }
    : item);
  const spdx = cleaned.flatMap((file) => {
    const preview = readSourceStable(file.entry.path).text.slice(0, 16_384);
    const match = preview.match(SPDX_RE);
    return match ? [{ file: file.entry.relPath, license: match[1] }] : [];
  });
  if (spdx.length) {
    items.push({
      status: 'warn',
      name: `检测到 ${spdx.length} 个 SPDX 许可证声明`,
      detail: '须复核代码是否为自研、合法授权及是否应从申请材料排除。',
      evidence: spdx.slice(0, 10).map((entry) => ({ location: { file: entry.file }, detail: `SPDX: ${entry.license}` })),
    });
  }
  const masked = cleaned.reduce((sum, file) => sum + file.maskedCount, 0);
  if (masked) {
    items.push({ status: 'warn', name: `已脱敏 ${masked} 行`, detail: '提交前须人工确认占位符未破坏代码可读性，审计日志不保存原始秘密。' });
  }
  if (excluded.length) {
    items.push({ status: 'pass', name: `排除 ${excluded.length} 个生成文件`, detail: '生成标记文件未计入有效源码。' });
  }
  if (selection.totalLines < LINES_PER_PAGE * MAX_PAGES) {
    items.push({ status: 'warn', name: '有效源码不足60页', detail: '必须确认当前用户确认的软件范围内全部合格自研源码均已提交。' });
  }
  const rank = { fail: 0, warn: 1, pass: 2 } as const;
  return items.sort((a, b) => rank[a.status] - rank[b.status]);
}

async function normalizeDocx(source: string, target: string): Promise<void> {
  const zip = await JSZip.loadAsync(fs.readFileSync(source));
  const core = zip.file('docProps/core.xml');
  if (core) {
    let xml = await core.async('string');
    xml = xml
      .replace(/<dcterms:created[^>]*>.*?<\/dcterms:created>/s, '<dcterms:created xsi:type="dcterms:W3CDTF">2000-01-01T00:00:00Z</dcterms:created>')
      .replace(/<dcterms:modified[^>]*>.*?<\/dcterms:modified>/s, '<dcterms:modified xsi:type="dcterms:W3CDTF">2000-01-01T00:00:00Z</dcterms:modified>');
    zip.file('docProps/core.xml', xml, { date: FIXED_ZIP_DATE });
  }
  for (const entry of Object.values(zip.files)) entry.date = FIXED_ZIP_DATE;
  const bytes = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    platform: 'UNIX',
  });
  atomicWrite(target, bytes);
}

function pageManifest(picked: SourceLineRecord[], pages: Page[]) {
  return pages.map((page, index) => {
    const chunk = picked.slice(index * LINES_PER_PAGE, index * LINES_PER_PAGE + page.lines.length);
    return {
      page: page.no,
      lineCount: chunk.length,
      start: { file: chunk[0].relPath, sourceLine: chunk[0].sourceLine, outputPart: chunk[0].outputPart },
      end: {
        file: chunk[chunk.length - 1].relPath,
        sourceLine: chunk[chunk.length - 1].sourceLine,
        outputPart: chunk[chunk.length - 1].outputPart,
      },
    };
  });
}

export async function runPipeline(configInput: SourceCoreConfig): Promise<PipelineResult> {
  const config = normalizeConfig(configInput);
  const outputDir = ensureOutputFence(config.outputDir);
  fs.mkdirSync(path.dirname(outputDir), { recursive: true });
  const staging = fs.mkdtempSync(path.join(path.dirname(outputDir), '.crabcopyright-source-'));
  try {
    const prepared = prepareEntries(config);
    const clean = buildCleanOptions(config);
    const { cleaned, records } = cleanWithMap(prepared.entries, clean);
    const selected = selectRecords(records);
    const upstreamConfig: ProjectConfig = {
      root: prepared.root,
      title: config.title,
      owner: config.owner,
      foundedDate: config.foundedDate,
      extensions: config.extensions ?? DEFAULT_EXTENSIONS,
      excludes: config.excludes ?? DEFAULT_EXCLUDES,
      sortMode: config.sortMode ?? 'entry',
      clean,
      linesPerPage: LINES_PER_PAGE,
      maxPages: MAX_PAGES,
    };
    const auditItems = addLocalAudit(audit(cleaned, selected.selection, upstreamConfig), cleaned, prepared.excluded, selected.selection)
      .map(sanitizeAuditItem);

    const baseName = config.baseName ?? '源代码材料';
    const stagedDocx = await renderDocx(selected.pages, { title: config.title, fontName: '宋体', fontSizePt: 10.5, outDir: staging, baseName });
    const sourceText = selected.records.map((line) => line.text).join('\n') + (selected.records.length ? '\n' : '');
    const selectionData = {
      schemaVersion: 1,
      pluginVersion: PLUGIN_VERSION,
      rulesVersion: RULES_VERSION,
      upstream: { version: UPSTREAM_VERSION, commit: UPSTREAM_COMMIT },
      title: config.title,
      clean,
      selectedFiles: selected.selection.selectedRelPaths,
      discoveredFiles: prepared.entries.map((entry) => ({
        path: entry.relPath,
        bytes: entry.sizeBytes,
        rawLines: entry.rawLines,
        encoding: cleaned.find((file) => file.entry.relPath === entry.relPath)?.entry.encoding ?? entry.encoding,
        sha256: sha256File(entry.path),
      })),
      excluded: prepared.excluded,
      totalEffectiveLines: records.length,
      pickedLines: selected.selection.pickedLines,
      pages: selected.pages.length,
      truncated: selected.selection.truncated,
      splitAfterPage: selected.selection.splitAfterPage,
    };
    const pagesData = { schemaVersion: 1, linesPerPage: LINES_PER_PAGE, maxPages: MAX_PAGES, pages: pageManifest(selected.records, selected.pages) };
    const auditStatus: PipelineResult['status'] = auditItems.some((item) => item.status === 'fail')
      ? 'fail'
      : auditItems.some((item) => item.status === 'warn') ? 'warn' : 'pass';
    const auditData = {
      schemaVersion: 1,
      rulesVersion: RULES_VERSION,
      status: auditStatus,
      items: auditItems,
    };
    const lineMap = selected.records.map((line, index) => JSON.stringify({
      page: Math.floor(index / LINES_PER_PAGE) + 1,
      outputLine: index + 1,
      pageLine: (index % LINES_PER_PAGE) + 1,
      file: line.relPath,
      sourceLine: line.sourceLine,
      outputPart: line.outputPart,
      masked: line.masked,
    })).join('\n') + (selected.records.length ? '\n' : '');

    const files = {
      sourceText: path.join(outputDir, `${baseName}.txt`),
      sourceDocx: path.join(outputDir, `${baseName}.docx`),
      selection: path.join(outputDir, 'source-selection.json'),
      audit: path.join(outputDir, 'source-audit.json'),
      lineMap: path.join(outputDir, 'source-line-map.jsonl'),
      pages: path.join(outputDir, 'source-pages.json'),
    };
    fs.mkdirSync(outputDir, { recursive: true });
    atomicWrite(files.sourceText, sourceText);
    await normalizeDocx(stagedDocx, files.sourceDocx);
    atomicWrite(files.selection, canonicalJson(selectionData));
    atomicWrite(files.audit, canonicalJson(auditData));
    atomicWrite(files.lineMap, lineMap);
    atomicWrite(files.pages, canonicalJson(pagesData));

    const hashes = Object.fromEntries(Object.entries(files).map(([key, value]) => [key, sha256File(value)]));
    const maskedLines = selected.records.filter((line) => line.masked).length;
    const result: PipelineResult = {
      status: auditData.status,
      rulesVersion: RULES_VERSION,
      pluginVersion: PLUGIN_VERSION,
      upstream: { version: UPSTREAM_VERSION, commit: UPSTREAM_COMMIT },
      stats: {
        discoveredFiles: prepared.entries.length + prepared.excluded.length,
        includedFiles: prepared.entries.length,
        excludedFiles: prepared.excluded.length,
        rawLines: prepared.entries.reduce((sum, entry) => sum + entry.rawLines, 0),
        effectiveLines: records.length,
        pickedLines: selected.records.length,
        pages: selected.pages.length,
        truncated: selected.selection.truncated,
        maskedLines,
      },
      files,
      hashes,
      auditItems,
      excluded: prepared.excluded,
    };
    return result;
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

function relativeToManifest(manifestPath: string, target: string): string {
  const manifestDir = fs.realpathSync(path.dirname(path.resolve(manifestPath)));
  const canonicalTarget = fs.existsSync(target) ? fs.realpathSync(target) : path.resolve(target);
  return toPosix(path.relative(manifestDir, canonicalTarget));
}

function updateManifest(manifestPath: string, manifest: Record<string, unknown>, result: PipelineResult, root: string): void {
  const source = asObject(manifest.source, 'manifest.source');
  source.root = relativeToManifest(manifestPath, root);
  const selection = JSON.parse(fs.readFileSync(result.files.selection, 'utf8')) as { selectedFiles: string[] };
  source.selected_files = selection.selectedFiles;
  source.total_lines = result.stats.rawLines;
  source.effective_lines = result.stats.effectiveLines;
  source.material_pages = result.stats.pages;
  source.selection_path = relativeToManifest(manifestPath, result.files.selection);
  source.audit_path = relativeToManifest(manifestPath, result.files.audit);
  source.line_map_path = relativeToManifest(manifestPath, result.files.lineMap);
  source.page_manifest_path = relativeToManifest(manifestPath, result.files.pages);

  const intermediates = manifest.intermediates && typeof manifest.intermediates === 'object'
    ? manifest.intermediates as Record<string, unknown>
    : (manifest.intermediates = {}) as Record<string, unknown>;
  intermediates.source_text = relativeToManifest(manifestPath, result.files.sourceText);
  intermediates.source_docx = relativeToManifest(manifestPath, result.files.sourceDocx);

  const artifacts = manifest.artifacts && typeof manifest.artifacts === 'object'
    ? manifest.artifacts as Record<string, unknown>
    : (manifest.artifacts = {}) as Record<string, unknown>;
  const validatedAgainst = {
    rules_version: RULES_VERSION,
    source_selection_sha256: result.hashes.selection,
    source_pages_sha256: result.hashes.pages,
  };
  artifacts.source_text = { path: relativeToManifest(manifestPath, result.files.sourceText), sha256: result.hashes.sourceText, validated_against: validatedAgainst };
  artifacts.source_docx = { path: relativeToManifest(manifestPath, result.files.sourceDocx), sha256: result.hashes.sourceDocx, validated_against: validatedAgainst };
  artifacts.source_audit = { path: relativeToManifest(manifestPath, result.files.audit), sha256: result.hashes.audit, validated_against: validatedAgainst };

  const steps = manifest.steps && typeof manifest.steps === 'object'
    ? manifest.steps as Record<string, unknown>
    : (manifest.steps = {}) as Record<string, unknown>;
  steps['source-code-material'] = {
    status: result.status === 'fail' ? 'blocked' : result.status === 'warn' ? 'in_progress' : 'done',
    updated_at: new Date().toISOString(),
  };
  atomicWrite(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function appendAuditLog(manifestPath: string, manifest: Record<string, unknown>, result: PipelineResult): void {
  const logValue = typeof manifest.audit_log_path === 'string' && manifest.audit_log_path
    ? manifest.audit_log_path
    : 'audit-log.jsonl';
  const logPath = path.resolve(path.dirname(manifestPath), logValue);
  const root = fs.realpathSync(path.dirname(path.resolve(manifestPath)));
  const canonicalLogPath = fs.existsSync(logPath)
    ? fs.realpathSync(logPath)
    : path.join(fs.realpathSync(path.dirname(logPath)), path.basename(logPath));
  if (!isInside(root, canonicalLogPath)) fail('audit_log_path 必须位于申请目录内');
  if (fs.existsSync(logPath) && fs.lstatSync(logPath).isSymbolicLink()) fail('audit log 不得是符号链接');
  fs.appendFileSync(logPath, `${JSON.stringify({
    timestamp: new Date().toISOString(),
    event: 'source-core.generate',
    pluginVersion: PLUGIN_VERSION,
    rulesVersion: RULES_VERSION,
    upstreamCommit: UPSTREAM_COMMIT,
    status: result.status,
    hashes: result.hashes,
  })}\n`, { encoding: 'utf8', mode: 0o600 });
}

function parseCli(argv: string[]) {
  const args = [...argv];
  const command = args.shift();
  if (command !== 'generate') fail('用法: source-core.js generate (--config <json> | --manifest <manifest.json>) [--output-dir <dir>]');
  let configPath = '';
  let manifestPath = '';
  let outputDir = '';
  while (args.length) {
    const flag = args.shift();
    const value = args.shift();
    if (!value || !['--config', '--manifest', '--output-dir'].includes(flag ?? '')) fail(`未知或不完整参数: ${flag ?? ''}`);
    if (flag === '--config') configPath = value;
    if (flag === '--manifest') manifestPath = value;
    if (flag === '--output-dir') outputDir = value;
  }
  if (!!configPath === !!manifestPath) fail('--config 与 --manifest 必须且只能提供一个');
  return { configPath, manifestPath, outputDir };
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  try {
    const cli = parseCli(argv);
    let config: SourceCoreConfig;
    let manifest: Record<string, unknown> | undefined;
    if (cli.manifestPath) {
      const built = buildConfigFromManifest(cli.manifestPath, cli.outputDir || undefined);
      config = built.config;
      manifest = built.manifest;
    } else {
      config = normalizeConfig(readJson(path.resolve(cli.configPath)));
      if (cli.outputDir) config.outputDir = cli.outputDir;
    }
    const result = await runPipeline(config);
    if (manifest && cli.manifestPath) {
      updateManifest(cli.manifestPath, manifest, result, ensureDirectory(config.root, '源码根目录'));
      appendAuditLog(cli.manifestPath, manifest, result);
    }
    process.stdout.write(canonicalJson(result));
    return result.status === 'fail' ? 1 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`source-core 失败: ${message}\n`);
    return 2;
  }
}

const isDirect = process.argv[1]
  && import.meta.url === pathToFileURL(fs.realpathSync(path.resolve(process.argv[1]))).href;
if (isDirect) {
  process.exitCode = await main();
}
