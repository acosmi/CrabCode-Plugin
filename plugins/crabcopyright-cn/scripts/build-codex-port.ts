import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const sourceRoot = path.resolve(import.meta.dir, "..");

function fail(message: string): never { throw new Error(message); }

function parseArgs(argv: string[]): { out: string; version: string } {
  let out = "";
  let version = "0.3.0";
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!value || !["--out", "--version"].includes(flag)) fail(`未知或不完整参数: ${flag ?? ""}`);
    if (flag === "--out") out = value;
    if (flag === "--version") version = value;
  }
  if (!out) fail("用法: build-codex-port.ts --out <non-existing-dir> [--version <semver+cachebuster>]");
  if (!/^0\.3\.0(?:\+codex\.[A-Za-z0-9._-]+)?$/.test(version)) fail(`Codex port 版本无效: ${version}`);
  return { out: path.resolve(out), version };
}

async function exists(target: string): Promise<boolean> {
  try { await stat(target); return true; } catch { return false; }
}

function replaceHostText(value: string, targetRoot: string): string {
  return value
    .replaceAll("${CRABCODE_PLUGIN_ROOT}", targetRoot)
    .replaceAll("crabcode-office-suite:crabcode-documents", "documents:documents")
    .replaceAll("crabcode-office-suite:crabcode-pdf", "pdf:pdf")
    .replaceAll("crabcode-office-suite:crabcode-spreadsheets", "spreadsheets:Spreadsheets")
    .replaceAll("用 Task 工具", "用 Codex 多代理工具（如当前环境可用）")
    .replaceAll("用 Task 派发", "用 Codex 多代理工具派发（如当前环境可用）")
    .replaceAll("Task 派发", "Codex 多代理工具派发（如当前环境可用）")
    .replaceAll("用 Task", "用 Codex 多代理工具（如当前环境可用）");
}

function replaceSkillHostText(value: string, targetRoot: string): string {
  return replaceHostText(value, targetRoot)
    .replaceAll("crabcode-office-suite 办公套件", "当前宿主可执行的文档/PDF能力")
    .replaceAll("`crabcode-office-suite`", "当前宿主文档/PDF能力");
}

function codexSkill(source: string, basename: string, targetRoot: string): string {
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) fail(`SKILL.md frontmatter 无法解析: ${basename}`);
  const lines = match[1].split("\n");
  const kept: string[] = [];
  let skippingAllowed = false;
  for (const line of lines) {
    if (/^allowed-tools:\s*$/.test(line)) { skippingAllowed = true; continue; }
    if (skippingAllowed) {
      if (/^\s+-\s+/.test(line)) continue;
      skippingAllowed = false;
    }
    if (/^(name|short-description|argument-hint|brand-color|icon-small|icon-large):/.test(line)) continue;
    kept.push(line);
  }
  const frontmatter = ["---", `name: ${basename}`, ...kept.filter(Boolean), "---"].join("\n");
  return replaceSkillHostText(`${frontmatter}\n${match[2]}`, targetRoot);
}

async function copyTextTree(source: string, target: string, targetRoot: string): Promise<void> {
  await mkdir(target, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const src = path.join(source, entry.name);
    const dst = path.join(target, entry.name);
    if (entry.isDirectory()) await copyTextTree(src, dst, targetRoot);
    else if (entry.isFile()) {
      const bytes = await readFile(src);
      const textLike = /\.(?:md|json|py|ts|txt)$/.test(entry.name) || entry.name === "README.md";
      await writeFile(dst, textLike ? replaceHostText(bytes.toString("utf8"), targetRoot) : bytes);
    } else fail(`拒绝复制符号链接/特殊文件: ${src}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (await exists(args.out)) fail(`输出目录已存在，拒绝覆盖: ${args.out}`);
  await mkdir(args.out, { recursive: false });
  const manifest = JSON.parse(await readFile(path.join(sourceRoot, ".crabcode-plugin", "plugin.json"), "utf8")) as {
    name: string; author: { name: string }; license: string; skills: string[];
  };
  const pluginManifest = {
    name: manifest.name,
    version: args.version,
    description: "软著申请管家:面向中国版权保护中心登记的全流程插件，包含离线确定性源码内核、manifest v2、AI 使用事实闸门、DOCX/PDF 与申请包校验。",
    author: { name: manifest.author.name, url: "https://github.com/acosmi/CrabCode-Plugin" },
    homepage: "https://github.com/acosmi/CrabCode-Plugin/tree/main/plugins/crabcopyright-cn",
    repository: "https://github.com/acosmi/CrabCode-Plugin",
    license: manifest.license,
    keywords: ["software-copyright", "copyright-registration", "china", "deterministic-source-core", "ai-provenance"],
    skills: "./skills/",
    interface: {
      displayName: "软著申请管家",
      shortDescription: "确定性源码60页、AI事实、说明书/PDF和提交包校验",
      longDescription: "面向中国软件著作权登记的全流程工作流。用锁定 CodeSucker v0.4.5 的离线核心生成可追溯源码 TXT/DOCX，并通过 manifest v2、AI 使用事实、最终 PDF 哈希绑定和提交白名单 fail-closed。",
      developerName: manifest.author.name,
      category: "Productivity",
      capabilities: ["Interactive", "Read", "Write"],
      defaultPrompt: [
        "帮我为这个项目规划软著申请，先核对 AI 使用和软件边界",
        "用确定性引擎整理软著源码鉴别材料",
        "提交前检查软著材料和 PDF 是否仍有效",
      ],
      brandColor: "#0F766E",
      screenshots: [],
    },
  };
  await mkdir(path.join(args.out, ".codex-plugin"), { recursive: true });
  await writeFile(path.join(args.out, ".codex-plugin", "plugin.json"), `${JSON.stringify(pluginManifest, null, 2)}\n`);
  await mkdir(path.join(args.out, "skills"), { recursive: true });

  for (const relative of manifest.skills) {
    const sourceDir = path.resolve(sourceRoot, relative);
    const basename = path.basename(sourceDir);
    const source = await readFile(path.join(sourceDir, "SKILL.md"), "utf8");
    const targetDir = path.join(args.out, "skills", basename);
    await mkdir(targetDir, { recursive: true });
    await writeFile(path.join(targetDir, "SKILL.md"), codexSkill(source, basename, args.out));
  }

  await writeFile(path.join(args.out, "README.md"), replaceHostText(await readFile(path.join(sourceRoot, "README.md"), "utf8"), args.out));
  await copyTextTree(path.join(sourceRoot, "agents"), path.join(args.out, "agents"), args.out);
  await copyTextTree(path.join(sourceRoot, "scripts"), path.join(args.out, "scripts"), args.out);
  await copyTextTree(path.join(sourceRoot, "docs"), path.join(args.out, "docs"), args.out);
  await copyTextTree(path.join(sourceRoot, "vendor"), path.join(args.out, "vendor"), args.out);
  await copyTextTree(path.join(sourceRoot, "evals"), path.join(args.out, "evals"), args.out);
  await cp(path.join(sourceRoot, "dist"), path.join(args.out, "dist"), { recursive: true, errorOnExist: true });
  await writeFile(path.join(args.out, "package.json"), await readFile(path.join(sourceRoot, "package.json")));
  await writeFile(path.join(args.out, "bun.lock"), await readFile(path.join(sourceRoot, "bun.lock")));
  await mkdir(path.join(args.out, "apply-core"), { recursive: true });
  for (const name of ["GUIDE.md", "MANIFEST.md"]) {
    await writeFile(path.join(args.out, "apply-core", name), replaceHostText(await readFile(path.join(sourceRoot, "apply-core", name), "utf8"), args.out));
  }
  await copyTextTree(path.join(sourceRoot, "apply-core", "rules"), path.join(args.out, "apply-core", "rules"), args.out);
  await copyTextTree(path.join(sourceRoot, "apply-core", "schemas"), path.join(args.out, "apply-core", "schemas"), args.out);
  process.stdout.write(`${args.out}\n`);
}

await main();
