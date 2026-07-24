import { describe, expect, test } from "bun:test";
import {
  access,
  lstat,
  mkdir,
  readFile,
  readdir,
  readlink,
  realpath,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  PLUGIN_ROOT,
  requireSuccess,
  run,
  tempDir,
  writeJson,
} from "./test-helpers.ts";

const script = path.join(PLUGIN_ROOT, "scripts", "write_scan_meta.py");
const renderReport = path.join(PLUGIN_ROOT, "scripts", "render_report.py");
const reportName = /^CRABCODE-SECURITY-\d{8}-\d{6}-[0-9a-f]{16}$/;
const ownerName = ".crabcode-security-owner.json";

type SnapshotMeta = Record<string, unknown> & {
  analysis_content: {
    algorithm: string;
    sha256: string;
    entries: number;
    bytes: number;
  };
};

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function outputPath(stdout: string, label: string): string {
  const prefix = `${label}: `;
  const line = stdout.split("\n").find((candidate) => candidate.startsWith(prefix));
  if (!line) throw new Error(`missing ${label} output in:\n${stdout}`);
  return JSON.parse(line.slice(prefix.length)) as string;
}

function git(root: string, ...args: string[]): string {
  const result = run("git", args, { cwd: root });
  requireSuccess(result, `git ${args.join(" ")}`);
  return result.stdout.trim();
}

async function initRepository(root: string): Promise<void> {
  git(root, "init", "-q");
  git(root, "config", "user.email", "security-tests@example.invalid");
  git(root, "config", "user.name", "Security Tests");
}

function createRun(
  root: string,
  mode: "scan" | "changes" | "commit",
  extra: string[] = [],
) {
  return run(
    "python3",
    [
      script,
      root,
      "--create-run",
      "--mode",
      mode,
      "--effort",
      "medium",
      ...extra,
    ],
    { cwd: root },
  );
}

async function createRenderableSnapshotRun(label: string): Promise<{
  root: string;
  reportDir: string;
  runDir: string;
  analysisRoot: string;
  metaPath: string;
  meta: SnapshotMeta;
}> {
  const root = await tempDir(label);
  await mkdir(path.join(root, "src"));
  await writeFile(path.join(root, "src", "app.py"), "print('snapshot')\n");
  await writeFile(path.join(root, "README.md"), "# snapshot fixture\n");

  const created = createRun(root, "scan");
  requireSuccess(created, "create renderable snapshot run");
  const reportDir = outputPath(created.stdout, "report_dir");
  const runDir = outputPath(created.stdout, "run_dir");
  const analysisRoot = outputPath(created.stdout, "analysis_root");
  const metaPath = path.join(runDir, "scan-meta.json");
  const meta = JSON.parse(await readFile(metaPath, "utf8")) as SnapshotMeta;

  await writeJson(path.join(runDir, "findings.json"), []);
  await writeJson(path.join(runDir, "votes.json"), {
    candidates: 0,
    candidates_deduped: 0,
    panel_votes: 0,
    researchers_dispatched: 1,
    researchers_returned: 1,
    unreviewed_candidate_sites: 0,
    rounds: {},
  });
  await writeFile(
    path.join(runDir, "CRABCODE-SECURITY-RESULTS.md"),
    "# No findings\n",
  );

  return { root, reportDir, runDir, analysisRoot, metaPath, meta };
}

describe("write_scan_meta.py atomic snapshot contract", () => {
  test("creates a nonce-owned run and counts root files as coverage entries", async () => {
    const root = await tempDir("meta-create");
    await mkdir(path.join(root, "src"));
    await writeFile(path.join(root, "src", "app.py"), "print('ok')\n");
    await writeFile(path.join(root, "Dockerfile"), "FROM scratch\n");
    await mkdir(path.join(root, "CRABCODE-SECURITY-legitimate-source"));
    await writeFile(
      path.join(root, "CRABCODE-SECURITY-legitimate-source", "module.py"),
      "VALUE = 1\n",
    );

    const result = createRun(root, "scan");
    requireSuccess(result, "create unversioned scan run");
    const reportDir = outputPath(result.stdout, "report_dir");
    const runDir = outputPath(result.stdout, "run_dir");
    const analysisRoot = outputPath(result.stdout, "analysis_root");

    expect(path.dirname(reportDir)).toBe(await realpath(root));
    expect(reportName.test(path.basename(reportDir))).toBe(true);
    expect(runDir).toBe(path.join(reportDir, ".crabcode-security-run"));
    expect(analysisRoot).toBe(path.join(runDir, "analysis-root"));
    expect(await readFile(path.join(reportDir, ".gitignore"), "utf8")).toBe("*\n");
    expect(await readFile(path.join(runDir, ".gitignore"), "utf8")).toBe("*\n");

    const reportOwnerText = await readFile(path.join(reportDir, ownerName), "utf8");
    const runOwnerText = await readFile(path.join(runDir, ownerName), "utf8");
    expect(runOwnerText).toBe(reportOwnerText);
    const owner = JSON.parse(reportOwnerText);
    expect(owner).toMatchObject({
      schema: "crabcode-security-run-owner/v1",
      owner: "crabcode-security",
      source_root: await realpath(root),
      report_dir: reportDir,
      run_dir: runDir,
    });
    expect(owner.run_id).toBe(path.basename(reportDir).replace("CRABCODE-SECURITY-", ""));

    const meta = JSON.parse(await readFile(path.join(runDir, "scan-meta.json"), "utf8"));
    expect(meta.scan_root).toBe(await realpath(root));
    expect(meta.source_root).toBe(await realpath(root));
    expect(meta.analysis_root).toBe(analysisRoot);
    expect(meta.snapshot_kind).toBe("directory-copy");
    expect(meta.top_level_entries).toEqual([
      "CRABCODE-SECURITY-legitimate-source",
      "Dockerfile",
      "src",
    ]);
    expect(meta.top_level_dirs).toEqual(meta.top_level_entries);
    expect(meta.analysis_content).toMatchObject({
      algorithm: "sha256-path-mode-content-v1",
      entries: 5,
    });
    expect(meta.analysis_content.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(await readFile(path.join(analysisRoot, "Dockerfile"), "utf8")).toBe(
      "FROM scratch\n",
    );
  });

  test("commit and changes scans read the requested endpoint, not dirty HEAD", async () => {
    const root = await tempDir("meta-endpoint");
    await initRepository(root);
    await writeFile(path.join(root, "app.txt"), "base\n");
    git(root, "add", "app.txt");
    git(root, "commit", "-q", "-m", "base");
    await writeFile(path.join(root, "app.txt"), "old endpoint\n");
    git(root, "commit", "-qam", "old");
    const oldCommit = git(root, "rev-parse", "HEAD");
    await writeFile(path.join(root, "app.txt"), "new HEAD\n");
    git(root, "commit", "-qam", "new");
    const newHead = git(root, "rev-parse", "HEAD");
    await writeFile(path.join(root, "app.txt"), "dirty working tree\n");
    await writeFile(path.join(root, "untracked.txt"), "not in endpoint\n");

    const before = {
      head: git(root, "rev-parse", "HEAD"),
      branch: git(root, "rev-parse", "--abbrev-ref", "HEAD"),
      status: run("git", ["status", "--porcelain=v1", "-z"], { cwd: root }).stdout,
      source: await readFile(path.join(root, "app.txt"), "utf8"),
      index: await readFile(path.join(root, ".git", "index")),
    };

    for (const [mode, extra] of [
      ["commit", ["--commit", oldCommit]],
      [
        "changes",
        [
          "--endpoint",
          oldCommit,
          "--base",
          `${oldCommit}^`,
          "--merge-base",
          `${oldCommit}^`,
        ],
      ],
    ] as const) {
      const result = createRun(root, mode, [...extra]);
      requireSuccess(result, `create ${mode} endpoint run`);
      const runDir = outputPath(result.stdout, "run_dir");
      const analysisRoot = outputPath(result.stdout, "analysis_root");
      const meta = JSON.parse(await readFile(path.join(runDir, "scan-meta.json"), "utf8"));
      expect(await readFile(path.join(analysisRoot, "app.txt"), "utf8")).toBe(
        "old endpoint\n",
      );
      expect(await exists(path.join(analysisRoot, "untracked.txt"))).toBe(false);
      expect(meta.revision).toMatchObject({
        versioned: true,
        commit: oldCommit,
        dirty: false,
      });
      expect(meta.source_revision).toMatchObject({
        versioned: true,
        commit: newHead,
        dirty: true,
      });
      expect(meta.snapshot_kind).toBe(
        mode === "commit"
          ? "git-commit-detached-clone"
          : "git-endpoint-detached-clone",
      );
      expect(
        git(analysisRoot, "diff", "--name-only", `${oldCommit}^..${oldCommit}`),
      ).toBe("app.txt");
      expect(git(analysisRoot, "remote")).toBe("");
    }

    expect(await readFile(path.join(root, ".git", "index"))).toEqual(before.index);
    expect(git(root, "rev-parse", "HEAD")).toBe(before.head);
    expect(git(root, "rev-parse", "--abbrev-ref", "HEAD")).toBe(before.branch);
    expect(run("git", ["status", "--porcelain=v1", "-z"], { cwd: root }).stdout).toBe(
      before.status,
    );
    expect(await readFile(path.join(root, "app.txt"), "utf8")).toBe(before.source);
  });

  test("a dirty whole-tree scan snapshots tracked and untracked visible files", async () => {
    const root = await tempDir("meta-dirty");
    await initRepository(root);
    await writeFile(path.join(root, ".gitignore"), "ignored.txt\n");
    await writeFile(path.join(root, "tracked.txt"), "committed\n");
    git(root, "add", ".gitignore", "tracked.txt");
    git(root, "commit", "-q", "-m", "base");
    await writeFile(path.join(root, "tracked.txt"), "dirty tracked\n");
    await writeFile(path.join(root, "untracked.txt"), "visible untracked\n");
    await writeFile(path.join(root, "ignored.txt"), "ignored\n");
    const beforeStatus = run("git", ["status", "--porcelain=v1", "-z"], {
      cwd: root,
    }).stdout;

    const result = createRun(root, "scan");
    requireSuccess(result, "create dirty working-tree run");
    const runDir = outputPath(result.stdout, "run_dir");
    const analysisRoot = outputPath(result.stdout, "analysis_root");
    const meta = JSON.parse(await readFile(path.join(runDir, "scan-meta.json"), "utf8"));
    expect(meta.revision.dirty).toBe(true);
    expect(meta.snapshot_kind).toBe("git-visible-worktree-detached-clone");
    expect(await readFile(path.join(analysisRoot, "tracked.txt"), "utf8")).toBe(
      "dirty tracked\n",
    );
    expect(await readFile(path.join(analysisRoot, "untracked.txt"), "utf8")).toBe(
      "visible untracked\n",
    );
    expect(await exists(path.join(analysisRoot, "ignored.txt"))).toBe(false);
    expect(run("git", ["status", "--porcelain=v1", "-z"], { cwd: root }).stdout).toBe(
      beforeStatus,
    );
  });

  test("a clean whole-tree scan snapshots exactly HEAD without ignored worktree files", async () => {
    const root = await tempDir("meta-clean-head");
    await initRepository(root);
    await mkdir(path.join(root, "src"));
    await writeFile(path.join(root, ".gitignore"), "ignored.txt\n");
    await writeFile(path.join(root, "src", "app.py"), "print('head')\n");
    await writeFile(path.join(root, "README.md"), "# committed\n");
    git(root, "add", ".gitignore", "src/app.py", "README.md");
    git(root, "commit", "-q", "-m", "clean head");
    const head = git(root, "rev-parse", "HEAD");
    await writeFile(path.join(root, "ignored.txt"), "worktree only\n");
    expect(run("git", ["status", "--porcelain=v1", "-z"], { cwd: root }).stdout).toBe(
      "",
    );

    const result = createRun(root, "scan");
    requireSuccess(result, "create clean HEAD scan run");
    const runDir = outputPath(result.stdout, "run_dir");
    const analysisRoot = outputPath(result.stdout, "analysis_root");
    const meta = JSON.parse(
      await readFile(path.join(runDir, "scan-meta.json"), "utf8"),
    );

    expect(meta.snapshot_kind).toBe("git-head-detached-clone");
    expect(meta.revision).toMatchObject({
      versioned: true,
      commit: head,
      dirty: false,
    });
    expect(meta.analysis_content.entries).toBeGreaterThan(0);
    expect(git(analysisRoot, "rev-parse", "HEAD")).toBe(head);
    expect(git(analysisRoot, "status", "--porcelain=v1")).toBe("");
    expect(git(analysisRoot, "remote")).toBe("");
    expect(await readFile(path.join(analysisRoot, "src", "app.py"), "utf8")).toBe(
      "print('head')\n",
    );
    expect(await readFile(path.join(analysisRoot, "README.md"), "utf8")).toBe(
      "# committed\n",
    );
    expect(await exists(path.join(analysisRoot, "ignored.txt"))).toBe(false);
    expect(await readFile(path.join(root, "ignored.txt"), "utf8")).toBe(
      "worktree only\n",
    );
    expect(run("git", ["status", "--porcelain=v1", "-z"], { cwd: root }).stdout).toBe(
      "",
    );
  });

  test("rendering recomputes a non-empty created snapshot digest and rejects either side of a mismatch", async () => {
    const intact = await createRenderableSnapshotRun("meta-render-intact");
    expect(intact.meta.analysis_content).toMatchObject({
      algorithm: "sha256-path-mode-content-v1",
    });
    expect(intact.meta.analysis_content.entries).toBeGreaterThan(0);
    expect(intact.meta.analysis_content.bytes).toBeGreaterThan(0);

    const rendered = run(
      "python3",
      [renderReport, intact.runDir, "--products-dir", intact.reportDir],
      { cwd: intact.root },
    );
    requireSuccess(rendered, "render intact created snapshot");
    const stamp = JSON.parse(
      await readFile(
        path.join(
          intact.reportDir,
          "CRABCODE-SECURITY-REVISION-UNVERSIONED.json",
        ),
        "utf8",
      ),
    );
    expect(stamp.analysis.content).toEqual(intact.meta.analysis_content);

    const metadataTamper =
      await createRenderableSnapshotRun("meta-render-digest-tamper");
    metadataTamper.meta.analysis_content.sha256 = "0".repeat(64);
    await writeJson(metadataTamper.metaPath, metadataTamper.meta);
    const rejectedMetadata = run(
      "python3",
      [
        renderReport,
        metadataTamper.runDir,
        "--products-dir",
        metadataTamper.reportDir,
      ],
      { cwd: metadataTamper.root },
    );
    expect(rejectedMetadata.status).toBe(1);
    expect(rejectedMetadata.stderr).toContain(
      "analysis_root content no longer matches scan-meta.json analysis_content",
    );
    expect(await exists(metadataTamper.runDir)).toBe(true);

    const snapshotTamper =
      await createRenderableSnapshotRun("meta-render-snapshot-tamper");
    await writeFile(
      path.join(snapshotTamper.analysisRoot, "src", "app.py"),
      "print('tampered')\n",
    );
    const rejectedSnapshot = run(
      "python3",
      [
        renderReport,
        snapshotTamper.runDir,
        "--products-dir",
        snapshotTamper.reportDir,
      ],
      { cwd: snapshotTamper.root },
    );
    expect(rejectedSnapshot.status).toBe(1);
    expect(rejectedSnapshot.stderr).toContain(
      "analysis_root content no longer matches scan-meta.json analysis_content",
    );
    expect(await exists(snapshotTamper.runDir)).toBe(true);
  });

  test("concurrent creates never share or reuse a run directory", async () => {
    const root = await tempDir("meta-concurrent");
    await writeFile(path.join(root, "root.txt"), "same snapshot\n");
    const command = [
      "python3",
      script,
      root,
      "--create-run",
      "--mode",
      "scan",
      "--effort",
      "low",
    ];
    const spawnOptions = {
      env: {
        ...process.env,
        PYTHONDONTWRITEBYTECODE: "1",
      },
    };
    const processes = [
      Bun.spawn(command, spawnOptions),
      Bun.spawn(command, spawnOptions),
    ];
    const results = await Promise.all(
      processes.map(async (process) => ({
        status: await process.exited,
        stdout: await new Response(process.stdout).text(),
        stderr: await new Response(process.stderr).text(),
      })),
    );
    for (const result of results) {
      expect(result.status, result.stderr).toBe(0);
    }
    const reports = results.map((result) => outputPath(result.stdout, "report_dir"));
    const runs = results.map((result) => outputPath(result.stdout, "run_dir"));
    expect(new Set(reports).size).toBe(2);
    expect(new Set(runs).size).toBe(2);
    for (const [index, runDir] of runs.entries()) {
      expect(await realpath(runDir)).toBe(runDir);
      expect(await lstat(runDir).then((info) => info.isDirectory())).toBe(true);
      expect(
        JSON.parse(await readFile(path.join(runDir, ownerName), "utf8")).report_dir,
      ).toBe(reports[index]);
    }
  });

  test("refuses symlinked output roots, legacy run aliases, and escaping source links", async () => {
    const root = await tempDir("meta-symlink");
    const realReports = path.join(root, "reports");
    const reportsAlias = path.join(root, "reports-link");
    await mkdir(realReports);
    await symlink(realReports, reportsAlias);
    const linkedReports = run(
      "python3",
      [
        script,
        root,
        "--create-run",
        "--reports-root",
        reportsAlias,
        "--mode",
        "scan",
        "--effort",
        "low",
      ],
      { cwd: root },
    );
    expect(linkedReports.status).toBe(2);
    expect(linkedReports.stderr).toContain("reports root must be a real directory");

    const realRun = path.join(root, "real-run");
    const runAlias = path.join(root, "run-link");
    await mkdir(realRun);
    await symlink(realRun, runAlias);
    const linkedRun = run(
      "python3",
      [script, runAlias, root, "--mode", "scan", "--effort", "low"],
      { cwd: root },
    );
    expect(linkedRun.status).toBe(2);
    expect(linkedRun.stderr).toContain("run directory must be a real directory");

    const external = path.join(await tempDir("meta-link-target"), "secret.txt");
    await writeFile(external, "outside\n");
    const escapeRoot = await tempDir("meta-link-source");
    await symlink(external, path.join(escapeRoot, "escape"));
    const escaping = createRun(escapeRoot, "scan");
    expect(escaping.status).toBe(2);
    expect(escaping.stderr).toContain("snapshot");
    expect(escaping.stderr).toContain("symlink");
    expect(
      (await readdir(escapeRoot)).filter((name) => name.startsWith("CRABCODE-SECURITY-")),
    ).toEqual([]);
    expect(await readlink(path.join(escapeRoot, "escape"))).toBe(external);
    expect(await readFile(external, "utf8")).toBe("outside\n");
  });
});
