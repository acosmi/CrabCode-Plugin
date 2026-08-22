import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import iconv from "iconv-lite";
import { annotate } from "../vendor/codesucker-core/src/clean.ts";
import { runPipeline, type SourceCoreConfig } from "../src/source-core-cli.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((entry) => rm(entry, { recursive: true, force: true })));
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "crabcopyright-core-"));
  roots.push(root);
  return root;
}

function baseConfig(root: string, outputDir: string): SourceCoreConfig {
  return {
    root,
    sourceDirs: ["src"],
    title: "测试源码管理系统 V1.0",
    owner: "测试科技有限公司",
    outputDir,
    sortMode: "entry",
    clean: {
      removeComments: true,
      removeBlankLines: true,
      maskSensitive: true,
      wrapLongLines: true,
      maxLineWidth: 78,
      tabWidth: 4,
    },
  };
}

describe("CodeSucker v0.4.5 source-core adaptation", () => {
  test("state machine preserves comment tokens inside strings", () => {
    const lines = annotate(
      'const url = "https://example.com/a//b"; // remove me\nconst hash = "#value";\n',
      "ts",
      {
        removeComments: true,
        removeBlankLines: true,
        maskSensitive: false,
        wrapLongLines: false,
        maxLineWidth: 78,
        tabWidth: 4,
      },
    ).flatMap((line) => line.out);
    expect(lines[0]).toBe('const url = "https://example.com/a//b";');
    expect(lines[1]).toBe('const hash = "#value";');
  });

  test("covers multiline and mixed-language comment boundaries", () => {
    const opts = {
      removeComments: true,
      removeBlankLines: true,
      maskSensitive: false,
      wrapLongLines: false,
      maxLineWidth: 120,
      tabWidth: 4,
    };
    const cases = [
      { ext: "py", input: '"""module comment"""\nprint("# not comment")\n', keep: '# not comment', remove: 'module comment' },
      { ext: "vue", input: '<template><!-- remove --><div>ok</div></template>\n', keep: '<div>ok</div>', remove: 'remove' },
      { ext: "ps1", input: '<# outer <# nested #> tail #>\nWrite-Host "<# text #>"\n', keep: '<# text #>', remove: 'outer' },
      { ext: "sql", input: "SELECT '--not comment' AS value; -- remove\n", keep: '--not comment', remove: 'remove' },
      { ext: "pas", input: "value := '//not comment'; // remove\n", keep: '//not comment', remove: 'remove' },
    ];
    for (const fixture of cases) {
      const output = annotate(fixture.input, fixture.ext, opts).flatMap((line) => line.out).join("\n");
      expect(output, fixture.ext).toContain(fixture.keep);
      expect(output, fixture.ext).not.toContain(fixture.remove);
    }
  });

  test("generates exact front/back pages, masked output and deterministic DOCX", async () => {
    const root = await tempRoot();
    const src = path.join(root, "src");
    await mkdir(src, { recursive: true });
    const lines = Array.from({ length: 3200 }, (_, index) => {
      if (index === 10) return 'const api_key = "abcdefghijklmnop";';
      if (index === 11) return 'const endpoint = "https://example.com/api"; // keep URL';
      return `const source_line_${index + 1} = ${index + 1};`;
    });
    await writeFile(path.join(src, "main.ts"), `${lines.join("\n")}\n`);
    await writeFile(path.join(src, "generated.ts"), "// @generated - DO NOT EDIT\nconst generated = true;\n");

    const first = await runPipeline(baseConfig(root, path.join(root, "out-a")));
    const second = await runPipeline(baseConfig(root, path.join(root, "out-b")));
    expect(first.status).not.toBe("fail");
    expect(first.stats.effectiveLines).toBe(3200);
    expect(first.stats.pickedLines).toBe(3000);
    expect(first.stats.pages).toBe(60);
    expect(first.stats.truncated).toBe(true);
    expect(first.excluded).toContainEqual({ relPath: "src/generated.ts", reason: "generated-marker" });
    expect(first.hashes.sourceDocx).toBe(second.hashes.sourceDocx);
    expect(first.hashes.sourceText).toBe(second.hashes.sourceText);
    expect(first.hashes.selection).toBe(second.hashes.selection);

    const text = await readFile(first.files.sourceText, "utf8");
    expect(text).not.toContain("abcdefghijklmnop");
    expect(text).toContain("ab****");
    expect(text).toContain("https://example.com/api");
    expect(text).not.toContain("keep URL");
    const auditText = await readFile(first.files.audit, "utf8");
    expect(auditText).not.toContain("abcdefghijklmnop");

    const pageData = JSON.parse(await readFile(first.files.pages, "utf8"));
    expect(pageData.pages).toHaveLength(60);
    expect(pageData.pages.every((page: { lineCount: number }) => page.lineCount === 50)).toBe(true);
    expect(pageData.pages[29].end.sourceLine).toBe(1500);
    expect(pageData.pages[30].start.sourceLine).toBe(1701);
    expect(pageData.pages[59].end.sourceLine).toBe(3200);

    const zip = await JSZip.loadAsync(await readFile(first.files.sourceDocx));
    const documentXml = await zip.file("word/document.xml")!.async("string");
    const headerXml = await zip.file("word/header1.xml")!.async("string");
    expect((documentXml.match(/w:pageBreakBefore/g) ?? []).length).toBe(59);
    expect(headerXml).toContain("测试源码管理系统 V1.0");
    expect(headerXml).toContain("PAGE");
  });

  test("decodes GB18030 source without replacement characters", async () => {
    const root = await tempRoot();
    const src = path.join(root, "src");
    await mkdir(src, { recursive: true });
    const code = "# 中文注释\nmessage = '中文内容'\nprint(message)\n";
    await writeFile(path.join(src, "gbk.py"), iconv.encode(code, "gb18030"));
    const result = await runPipeline(baseConfig(root, path.join(root, "out")));
    const text = await readFile(result.files.sourceText, "utf8");
    expect(text).toContain("中文内容");
    expect(text).not.toContain("�");
  });

  test("honors ignore and safety filters while submitting all eligible short source", async () => {
    const root = await tempRoot();
    const src = path.join(root, "src");
    await mkdir(path.join(src, "vendor"), { recursive: true });
    await mkdir(path.join(src, "third_party"), { recursive: true });
    await writeFile(path.join(root, ".gitignore"), "src/ignored.py\n");
    await writeFile(path.join(src, "main.ts"), `${Array.from({ length: 120 }, (_, index) => `const kept_${index + 1} = ${index + 1};`).join("\n")}\n`);
    await writeFile(path.join(src, "ignored.py"), "print('ignored')\n");
    await writeFile(path.join(src, "binary.ts"), Buffer.from([0, 1, 2, 3]));
    await writeFile(path.join(src, "oversized.ts"), Buffer.alloc(2 * 1024 * 1024 + 1, 97));
    await writeFile(path.join(src, "vendor", "dependency.ts"), "const dependency = true;\n");
    await writeFile(path.join(src, "third_party", "dependency.ts"), "const thirdParty = true;\n");

    const result = await runPipeline(baseConfig(root, path.join(root, "out")));
    const selection = JSON.parse(await readFile(result.files.selection, "utf8"));
    const output = await readFile(result.files.sourceText, "utf8");

    expect(selection.selectedFiles).toEqual(["src/main.ts"]);
    expect(result.stats.effectiveLines).toBe(120);
    expect(result.stats.pickedLines).toBe(120);
    expect(result.stats.pages).toBe(3);
    expect(result.stats.truncated).toBe(false);
    expect(output).toContain("kept_120");
    expect(output).not.toContain("dependency");
    expect(result.auditItems.some((item) => item.name === "有效源码不足60页")).toBe(true);
  });

  test("preserves SPDX provenance as a review warning", async () => {
    const root = await tempRoot();
    const src = path.join(root, "src");
    await mkdir(src, { recursive: true });
    await writeFile(path.join(src, "licensed.ts"), "// SPDX-License-Identifier: MIT\nconst licensed = true;\n");
    const result = await runPipeline(baseConfig(root, path.join(root, "out")));
    expect(result.auditItems.some((item) => item.name.includes("SPDX") && item.status === "warn")).toBe(true);
    expect(await readFile(result.files.sourceText, "utf8")).not.toContain("SPDX-License-Identifier");
  });

  test("does not include a symlink target outside the confirmed source root", async () => {
    const root = await tempRoot();
    const external = await tempRoot();
    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(path.join(root, "src", "main.ts"), "const safe = true;\n");
    await writeFile(path.join(external, "secret.ts"), "const outside_secret = true;\n");
    await symlink(path.join(external, "secret.ts"), path.join(root, "src", "linked.ts"));
    let result;
    try {
      result = await runPipeline(baseConfig(root, path.join(root, "out")));
    } catch (error) {
      expect(String(error)).toContain("符号链接");
      return;
    }
    expect(await readFile(result.files.sourceText, "utf8")).not.toContain("outside_secret");
  });

  test("rejects a symlinked directory before discovery can traverse it", async () => {
    const root = await tempRoot();
    const external = await tempRoot();
    await mkdir(path.join(root, "src"), { recursive: true });
    await mkdir(path.join(external, "nested"), { recursive: true });
    await writeFile(path.join(root, "src", "main.ts"), "const safe = true;\n");
    await writeFile(path.join(external, "nested", "outside.ts"), "const outside = true;\n");
    await symlink(path.join(external, "nested"), path.join(root, "src", "linked-dir"));
    await expect(runPipeline(baseConfig(root, path.join(root, "out")))).rejects.toThrow("含符号链接");
  });

  test("manifest mode updates only portable paths and artifact hashes", async () => {
    const root = await tempRoot();
    const project = path.join(root, "project");
    const app = path.join(root, "application");
    await mkdir(path.join(project, "src"), { recursive: true });
    await mkdir(app, { recursive: true });
    await writeFile(path.join(project, "src", "main.ts"), "const ready = true;\n".repeat(120));
    const manifestPath = path.join(app, "manifest.json");
    const manifest = {
      schema_version: 2,
      plugin_version: "0.3.0",
      rules_version: "2026.03.15.1",
      rules_verified_at: "2026-08-21",
      application_name: "软著申请-测试源码管理系统V1.0",
      software: { full_name: "测试源码管理系统", short_name: "测试源码", version: "V1.0" },
      applicant: { copyright_owner: "测试科技有限公司", type: "企业", dev_method: "独立开发", acquisition: "原始取得" },
      dates: { dev_complete: "2026-01-01", first_publish: "未发表", apply_date: "", company_established: "2020-01-01" },
      ai_assistance: {
        code: "no", manual: "no", application_materials: "no",
        current_workflow_used_ai: false, provenance: [], applicant_acknowledged: true,
      },
      source: {
        root: "../project",
        dirs: ["src"],
        include_files: [],
        selected_files: [],
        scope_confirmed: true,
        processing: {
          remove_comments: true,
          remove_blank_lines: true,
          mask_sensitive: true,
          wrap_long_lines: true,
          max_line_width: 78,
          tab_width: 4,
        },
      },
      manual: { source_path: "", doc_type: "用户手册", screenshot_plan: [] },
      materials: {},
      steps: {},
      artifacts: {},
      audit_log_path: "audit-log.jsonl",
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const proc = Bun.spawnSync({
      cmd: ["bun", "run", "src/source-core-cli.ts", "generate", "--manifest", manifestPath],
      cwd: path.resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    });
    if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());
    expect(proc.exitCode).toBe(0);
    const updated = JSON.parse(await readFile(manifestPath, "utf8"));
    expect(updated.source.selected_files).toEqual(["src/main.ts"]);
    expect(updated.source.selection_path).toBe("中间态/source-selection.json");
    expect(updated.artifacts.source_docx.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(updated)).not.toContain(root);
    expect(await Bun.file(path.join(app, "audit-log.jsonl")).exists()).toBe(true);
  });

  test("manifest mode rejects an output directory outside the application root", async () => {
    const root = await tempRoot();
    const project = path.join(root, "project");
    const app = path.join(root, "application");
    const outside = path.join(root, "outside");
    await mkdir(path.join(project, "src"), { recursive: true });
    await mkdir(app, { recursive: true });
    await writeFile(path.join(project, "src", "main.ts"), "const ready = true;\n".repeat(80));
    const manifestPath = path.join(app, "manifest.json");
    await writeFile(manifestPath, `${JSON.stringify({
      schema_version: 2,
      plugin_version: "0.3.0",
      rules_version: "2026.03.15.1",
      software: { full_name: "测试源码管理系统", version: "V1.0" },
      applicant: { copyright_owner: "测试科技有限公司" },
      dates: {},
      ai_assistance: {
        code: "no", manual: "no", application_materials: "no",
        current_workflow_used_ai: false, provenance: [], applicant_acknowledged: true,
      },
      source: {
        root: "../project", dirs: ["src"], include_files: [], scope_confirmed: true,
        processing: {
          remove_comments: true, remove_blank_lines: true, mask_sensitive: true,
          wrap_long_lines: true, max_line_width: 78, tab_width: 4,
        },
      },
    }, null, 2)}\n`);

    const proc = Bun.spawnSync({
      cmd: ["bun", "run", "src/source-core-cli.ts", "generate", "--manifest", manifestPath, "--output-dir", outside],
      cwd: path.resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(proc.exitCode).toBe(2);
    expect(proc.stderr.toString()).toContain("输出目录必须位于申请目录内");
    expect(await Bun.file(path.join(outside, "源代码材料.txt")).exists()).toBe(false);
  });
});
