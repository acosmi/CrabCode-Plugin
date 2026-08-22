import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dir, "../..");
const scriptsDir = path.join(repoRoot, "plugins", "crabcopyright-cn", "scripts");
const python = process.env.COPYRIGHT_TEST_PYTHON || "python3";
const strongPdfPython = process.env.COPYRIGHT_PDF_PYTHON;
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((entry) => rm(entry, { recursive: true, force: true })));
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "crabcopyright-test-"));
  tempRoots.push(root);
  return root;
}

function runPython(script: string, args: string[] = []) {
  const proc = Bun.spawnSync({
    cmd: [python, path.join(scriptsDir, script), ...args],
    cwd: repoRoot,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    exitCode: proc.exitCode,
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
  };
}

function fakePdf(pages: number, name: string, version: string): string {
  const pageObjects = Array.from({ length: pages }, (_, index) =>
    `${index + 1} 0 obj\n<< /Type /Page /Label (${name} ${version} ${index + 1}) >>\nendobj`,
  ).join("\n");
  return `%PDF-1.4\n${pageObjects}\n% ${name} ${version}\n${"x".repeat(2048)}\n%%EOF\n`;
}

async function createCompleteApplication(root: string) {
  const appDir = path.join(root, "application");
  const sourceDir = path.join(root, "source");
  const intermediateDir = path.join(appDir, "中间态");
  await mkdir(intermediateDir, { recursive: true });
  await mkdir(sourceDir, { recursive: true });
  const sourceLines = Array.from({ length: 3000 }, (_, index) => `const value_${index} = ${index};`).join("\n");
  await writeFile(path.join(sourceDir, "main.ts"), `${sourceLines}\n`);

  const softwareName = "测试业务管理系统";
  const version = "V1.0";
  await writeFile(
    path.join(intermediateDir, "manual.txt"),
    `${softwareName} ${version}\n目录\n概述\n运行环境\n安装\n功能\n${"说明".repeat(200)}\n`,
  );
  await writeFile(path.join(intermediateDir, "功能说明.txt"), "功能".repeat(300));

  for (const file of ["01-软件著作权登记申请表.pdf", "04-身份证明文件.pdf"]) {
    await writeFile(path.join(appDir, file), fakePdf(1, softwareName, version));
  }
  await writeFile(path.join(appDir, "02-源代码鉴别材料.pdf"), fakePdf(60, softwareName, version));
  await writeFile(path.join(appDir, "03-说明书鉴别材料.pdf"), fakePdf(10, softwareName, version));

  const screenshotPlan = Array.from({ length: 5 }, (_, index) => ({
    page: `页面${index + 1}`,
    route: `/page-${index + 1}`,
    url: `http://localhost:5173/page-${index + 1}`,
    feature: `功能${index + 1}`,
  }));
  const manifest = {
    schema_version: 2,
    plugin_version: "0.3.0",
    rules_version: "2026.03.15.1",
    rules_verified_at: "2026-08-21",
    application_name: `软著申请-${softwareName}${version}`,
    software: { full_name: softwareName, short_name: "测试业务", version, classification_code: "" },
    applicant: {
      copyright_owner: "测试科技有限公司",
      type: "企业",
      dev_method: "独立开发",
      acquisition: "原始取得",
      agent_name: "",
    },
    dates: {
      dev_complete: "2026-01-01",
      first_publish: "未发表",
      apply_date: "2026-08-21",
      company_established: "2020-01-01",
    },
    ai_assistance: {
      code: "no",
      manual: "no",
      application_materials: "no",
      current_workflow_used_ai: false,
      provenance: [],
      applicant_acknowledged: true,
    },
    source: {
      root: "../source",
      dirs: ["."],
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
      total_lines: 3000,
      effective_lines: 3000,
      material_pages: 60,
      selection_path: "",
      audit_path: "",
      line_map_path: "",
      page_manifest_path: "",
    },
    manual: { source_path: "中间态/manual.txt", doc_type: "用户手册", screenshot_plan: screenshotPlan },
    func_description_path: "中间态/功能说明.txt",
    intermediates: { source_text: "", source_docx: "", manual_docx: "中间态/manual.txt" },
    artifacts: {},
    materials: {
      "01-软件著作权登记申请表.pdf": { path: "01-软件著作权登记申请表.pdf", status: "✅" },
      "02-源代码鉴别材料.pdf": { path: "02-源代码鉴别材料.pdf", status: "✅" },
      "03-说明书鉴别材料.pdf": { path: "03-说明书鉴别材料.pdf", status: "✅" },
      "04-身份证明文件.pdf": { path: "04-身份证明文件.pdf", status: "✅" },
      "05-其他材料": { path: "", status: "⚠️" },
    },
    steps: {},
    audit_log_path: "audit-log.jsonl",
  };
  const manifestPath = path.join(appDir, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const sourceCore = Bun.spawnSync({
    cmd: ["node", path.join(repoRoot, "plugins", "crabcopyright-cn", "dist", "source-core.js"), "generate", "--manifest", manifestPath],
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (sourceCore.exitCode !== 0) throw new Error(sourceCore.stderr.toString());
  for (const [kind, filename] of [
    ["source_pdf", "02-源代码鉴别材料.pdf"],
    ["manual_pdf", "03-说明书鉴别材料.pdf"],
  ] as const) {
    const recorded = runPython("record_artifact.py", [
      "--manifest", manifestPath, "--kind", kind, "--path", path.join(appDir, filename),
    ]);
    if (recorded.exitCode !== 0) throw new Error(recorded.stderr);
  }
  return { appDir, manifest, manifestPath };
}

describe("crabcopyright-cn deterministic scripts", () => {
  test("rule registry is structurally valid", () => {
    const result = runPython("check_rules.py", ["--json"]);
    expect(result.exitCode).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.status).toBe("pass");
    expect(report.data.rules_version).toBe("2026.03.15.1");
  });

  test("AI gate blocks unknown facts and passes acknowledged no-AI facts", async () => {
    const root = await tempRoot();
    const unknownPath = path.join(root, "unknown.json");
    await writeFile(unknownPath, JSON.stringify({}));
    const blocked = runPython("check_ai.py", ["--manifest", unknownPath, "--json"]);
    expect(blocked.exitCode).toBe(1);
    expect(JSON.parse(blocked.stdout).status).toBe("fail");

    const passPath = path.join(root, "pass.json");
    await writeFile(passPath, JSON.stringify({
      ai_assistance: {
        code: "no", manual: "no", application_materials: "no",
        current_workflow_used_ai: false, provenance: [], applicant_acknowledged: true,
      },
    }));
    const passed = runPython("check_ai.py", ["--manifest", passPath, "--json"]);
    expect(passed.exitCode).toBe(0);
    expect(JSON.parse(passed.stdout).status).toBe("pass");
  });

  test("manifest privacy gate rejects persisted identity numbers", async () => {
    const root = await tempRoot();
    const manifestPath = path.join(root, "manifest.json");
    await writeFile(manifestPath, JSON.stringify({
      schema_version: 2,
      plugin_version: "0.3.0",
      rules_version: "2026.03.15.1",
      rules_verified_at: "2026-08-21",
      application_name: "测试申请",
      software: { full_name: "测试软件", version: "V1.0" },
      applicant: { copyright_owner: "测试公司", id_number: "110101199001011234" },
      dates: {},
      source: {
        root: "../source", dirs: ["src"], include_files: [], selected_files: [], scope_confirmed: true,
        processing: { remove_comments: true, remove_blank_lines: true, mask_sensitive: true,
          wrap_long_lines: true, max_line_width: 78, tab_width: 4 },
      },
      manual: {}, ai_assistance: {}, materials: {}, steps: {},
    }));
    const result = runPython("check_manifest.py", ["--manifest", manifestPath, "--json"]);
    expect(result.exitCode).toBe(1);
    expect(JSON.stringify(JSON.parse(result.stdout))).toContain("不得保存身份证号字段");
  });

  test("date check leaves a missing application date explicit and reproducible", () => {
    const result = runPython("check_dates.py", ["--dev-complete", "2026-01-01", "--json"]);
    expect(result.exitCode).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.status).toBe("warn");
    expect(report.data.apply_date).toBe("");
    expect(report.summary).toContain("未填写");
  });

  test("manifest migration is preview-only by default and adds v2 gates", async () => {
    const root = await tempRoot();
    const manifestPath = path.join(root, "manifest.json");
    const original = { application_name: "旧申请", software: { full_name: "旧软件", version: "V1.0" } };
    await writeFile(manifestPath, `${JSON.stringify(original)}\n`);
    const result = runPython("migrate_manifest.py", [manifestPath]);
    expect(result.exitCode).toBe(0);
    const migrated = JSON.parse(result.stdout);
    expect(migrated.schema_version).toBe(2);
    expect(migrated.plugin_version).toBe("0.3.0");
    expect(migrated.ai_assistance.code).toBe("unknown");
    expect(await Bun.file(manifestPath).json()).toEqual(original);
  });

  test("duplicate source files are review warnings, not invented official failures", async () => {
    const root = await tempRoot();
    const a = path.join(root, "a");
    const b = path.join(root, "b");
    await mkdir(a);
    await mkdir(b);
    const code = Array.from({ length: 80 }, (_, index) => `const same_${index} = ${index};`).join("\n");
    await writeFile(path.join(a, "same.ts"), code);
    await writeFile(path.join(b, "same.ts"), code);
    const result = runPython("check_overlap.py", [a, "--vs", b, "--json"]);
    expect(result.exitCode).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.status).toBe("warn");
    expect(report.items.some((item: { message: string }) => item.message.includes("合法共享模块"))).toBe(true);
  });

  test("complete v2 application never fails, even when PDF parsing degrades to warnings", async () => {
    const root = await tempRoot();
    const { manifestPath } = await createCompleteApplication(root);
    const result = runPython("check_all.py", ["--manifest", manifestPath, "--json"]);
    expect(result.exitCode).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.status).not.toBe("fail");
    expect(report.results.some((entry: { check: string; status: string }) =>
      entry.check === "ai-assistance" && entry.status === "pass",
    )).toBe(true);
  });

  test("removing one mandatory material makes the total gate fail", async () => {
    const root = await tempRoot();
    const { appDir, manifestPath } = await createCompleteApplication(root);
    await rm(path.join(appDir, "04-身份证明文件.pdf"));
    const result = runPython("check_all.py", ["--manifest", manifestPath, "--json"]);
    expect(result.exitCode).toBe(1);
    const report = JSON.parse(result.stdout);
    expect(report.status).toBe("fail");
    expect(JSON.stringify(report)).toContain("04-身份证明文件.pdf");
  });

  test("changing a bound PDF invalidates the artifact gate", async () => {
    const root = await tempRoot();
    const { appDir, manifestPath } = await createCompleteApplication(root);
    await writeFile(path.join(appDir, "02-源代码鉴别材料.pdf"), fakePdf(60, "被篡改软件", "V9.9"));
    const result = runPython("check_artifacts.py", ["--manifest", manifestPath, "--json"]);
    expect(result.exitCode).toBe(1);
    const report = JSON.parse(result.stdout);
    expect(report.status).toBe("fail");
    expect(JSON.stringify(report)).toContain("source_pdf SHA-256 已失效");
  });

  test("artifact recording, validation and packaging reject in-root material symlinks", async () => {
    const root = await tempRoot();
    const { appDir, manifestPath } = await createCompleteApplication(root);
    const sourcePdf = path.join(appDir, "02-源代码鉴别材料.pdf");
    const targetPdf = path.join(appDir, "source-target.pdf");
    await writeFile(targetPdf, fakePdf(60, "测试业务管理系统", "V1.0"));
    await rm(sourcePdf);
    await symlink(targetPdf, sourcePdf);

    const checked = runPython("check_artifacts.py", ["--manifest", manifestPath, "--json"]);
    expect(checked.exitCode).toBe(1);
    expect(JSON.stringify(JSON.parse(checked.stdout))).toContain("符号链接");

    const recorded = runPython("record_artifact.py", [
      "--manifest", manifestPath, "--kind", "source_pdf", "--path", sourcePdf,
    ]);
    expect(recorded.exitCode).toBe(2);
    expect(recorded.stderr).toContain("符号链接");

    const packaged = runPython("build_package.py", [
      "--manifest", manifestPath, "--allow-warn", "--review-note", "符号链接拒绝测试",
    ]);
    expect(packaged.exitCode).toBe(2);
    expect(await Bun.file(path.join(appDir, "提交件", "02-源代码鉴别材料.pdf")).exists()).toBe(false);
  });

  test("package builder creates only the submission whitelist and never overwrites it", async () => {
    const root = await tempRoot();
    const { appDir, manifestPath } = await createCompleteApplication(root);
    const built = runPython("build_package.py", [
      "--manifest", manifestPath,
      "--allow-warn",
      "--review-note", "测试夹具中的经验告警已复核",
    ]);
    expect(built.exitCode).toBe(0);
    const packageDir = path.join(appDir, "提交件");
    const entries = [...new Bun.Glob("*").scanSync({ cwd: packageDir })].sort();
    expect(entries).toEqual([
      "01-软件著作权登记申请表.pdf",
      "02-源代码鉴别材料.pdf",
      "03-说明书鉴别材料.pdf",
      "04-身份证明文件.pdf",
    ]);
    expect(entries).not.toContain("manifest.json");
    expect(await Bun.file(path.join(appDir, "材料自查对照表.md")).exists()).toBe(true);

    const second = runPython("build_package.py", [
      "--manifest", manifestPath,
      "--allow-warn",
      "--review-note", "重复运行",
    ]);
    expect(second.exitCode).toBe(2);
    expect(second.stderr).toContain("拒绝覆盖");
  });

  (strongPdfPython ? test : test.skip)("strong PDF parser checks every source page header and page number", async () => {
    const root = await tempRoot();
    const good = path.join(root, "good.pdf");
    const bad = path.join(root, "bad.pdf");
    const generator = String.raw`
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
import sys
out, bad = sys.argv[1], sys.argv[2] == "1"
c = canvas.Canvas(out, pagesize=A4)
for page in range(1, 4):
    if not (bad and page == 2):
        c.setFont("Helvetica", 9)
        c.drawString(48, A4[1] - 36, "Test Source System V1.0")
        c.drawRightString(A4[0] - 48, A4[1] - 36, str(page))
    c.setFont("Courier", 8)
    for line in range(50):
        c.drawString(48, A4[1] - 58 - line * 14, f"const value_{page}_{line} = {line};")
    c.showPage()
c.save()
`;
    for (const [target, isBad] of [[good, "0"], [bad, "1"]] as const) {
      const generated = Bun.spawnSync({ cmd: [strongPdfPython!, "-c", generator, target, isBad], stdout: "pipe", stderr: "pipe" });
      if (generated.exitCode !== 0) throw new Error(generated.stderr.toString());
    }
    const runStrong = (target: string) => {
      const proc = Bun.spawnSync({
        cmd: [strongPdfPython!, path.join(scriptsDir, "check_pdf.py"), target,
          "--name", "Test Source System", "--version", "V1.0", "--kind", "source",
          "--expected-pages", "3", "--json"],
        stdout: "pipe", stderr: "pipe",
      });
      return { exitCode: proc.exitCode, report: JSON.parse(proc.stdout.toString()) };
    };
    const goodResult = runStrong(good);
    expect(goodResult.exitCode).toBe(0);
    expect(goodResult.report.status).toBe("pass");
    expect(goodResult.report.data.reader).toBe("pdfplumber");
    expect(goodResult.report.data.pages_text).toHaveLength(3);

    const badResult = runStrong(bad);
    expect(badResult.exitCode).toBe(1);
    expect(badResult.report.status).toBe("fail");
    expect(JSON.stringify(badResult.report)).toContain("[2]");
  });
});
