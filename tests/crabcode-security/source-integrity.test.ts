import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { PLUGIN_ROOT, REPO_ROOT } from "./test-helpers.ts";

const expectedPortedPaths = [
  ".crabcode-plugin/plugin.json",
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "agents/crabcode-security.md",
  "agents/explore.md",
  "agents/patch-generator.md",
  "agents/patch-verifier.md",
  "agents/scan-inventory.md",
  "agents/scan-researcher.md",
  "agents/scan-verifier.md",
  "hooks/banner_hook.sh",
  "hooks/banner_notice.py",
  "hooks/hooks.json",
  "scripts/patch_artifacts.py",
  "scripts/render_report.py",
  "scripts/write_scan_meta.py",
  "skills/crabcode-security/SKILL.md",
  "skills/crabcode-security/jobs/scan-changes.md",
  "skills/crabcode-security/jobs/scan-codebase.md",
  "skills/crabcode-security/jobs/suggest-patches.md",
  "skills/crabcode-security/role.md",
  "skills/crabcode-security/specs/patch-spec.md",
  "skills/crabcode-security/specs/report-spec.md",
  "workflows/scan.js",
].sort();

const executablePaths = [
  "hooks/banner_hook.sh",
  "hooks/banner_notice.py",
  "scripts/patch_artifacts.py",
  "scripts/render_report.py",
  "scripts/write_scan_meta.py",
].sort();

async function filesUnder(root: string, relative = ""): Promise<string[]> {
  const directory = path.join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries) {
    const child = path.posix.join(relative.split(path.sep).join(path.posix.sep), entry.name);
    if (child === "docs/legal" || child.startsWith("docs/legal/")) continue;
    if (entry.isDirectory()) paths.push(...(await filesUnder(root, child)));
    else if (entry.isFile() || entry.isSymbolicLink()) paths.push(child);
  }
  return paths.sort();
}

function sortJson(value: any): any {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortJson(value[key])]),
    );
  }
  return value;
}

describe("CrabCode Security source-port completeness", () => {
  test("contains the complete 25-file target mapping outside provenance records", async () => {
    const actual = await filesUnder(PLUGIN_ROOT);
    expect(expectedPortedPaths).toHaveLength(25);
    expect(actual).toEqual(expectedPortedPaths);
  });

  test("preserves all five upstream executable bits and no others", async () => {
    const actualExecutable: string[] = [];
    for (const relative of expectedPortedPaths) {
      const info = await lstat(path.join(PLUGIN_ROOT, relative));
      expect(info.isFile()).toBe(true);
      expect(info.isSymbolicLink()).toBe(false);
      expect(info.size).toBeGreaterThan(0);
      if ((info.mode & 0o111) !== 0) actualExecutable.push(relative);
    }
    expect(actualExecutable.sort()).toEqual(executablePaths);
  });

  test("strictly cross-checks the authoritative source lock against the target mapping", async () => {
    const sourceLockPath = path.join(PLUGIN_ROOT, "docs", "legal", "SOURCE-LOCK.json");
    const lock = JSON.parse(await readFile(sourceLockPath, "utf8"));
    expect(lock.schemaVersion).toBe(1);
    expect(lock.lockKind).toBe("complete-source-port-provenance");
    expect(lock.port).toMatchObject({
      targetRoot: "plugins/crabcode-security",
      mappingCardinality: "one-to-one",
      expectedSourceFiles: 25,
      observedSourceFiles: 25,
      observedUniqueTargetPaths: 25,
      unmappedSourcePaths: [],
      duplicatedTargetPaths: [],
    });
    expect(lock.upstream.plugin).toMatchObject({
      fileCount: 25,
      byteCount: 246940,
    });
    expect(lock.files).toHaveLength(25);

    const targetPaths = lock.files.map((entry: any) => entry.targetRelativePath).sort();
    expect(targetPaths).toEqual(expectedPortedPaths);
    expect(new Set(targetPaths).size).toBe(25);
    const definedAxes = Object.keys(lock.port.changeAxisDefinitions).sort();
    const usedAxes = [
      ...new Set<string>(
        lock.files.flatMap((entry: any): string[] =>
          Array.isArray(entry.changeAxes)
            ? (entry.changeAxes as string[])
            : [],
        ),
      ),
    ].sort();
    expect(definedAxes).toEqual(usedAxes);

    const lockExecutable = lock.files
      .filter((entry: any) => entry.mode === "100755")
      .map((entry: any) => entry.targetRelativePath)
      .sort();
    expect(lockExecutable).toEqual(executablePaths);

    const upstreamProduct = `c${"laude"}`;
    const expectedSources = expectedPortedPaths
      .map((target) =>
        target
          .replace(".crabcode-plugin/", `.${upstreamProduct}-plugin/`)
          .replace("agents/crabcode-security.md", `agents/${upstreamProduct}-security.md`)
          .replaceAll("skills/crabcode-security/", `skills/${upstreamProduct}-security/`),
      )
      .sort();
    expect(lock.files.map((entry: any) => entry.sourceRelativePath).sort()).toEqual(
      expectedSources,
    );

    for (const entry of lock.files) {
      expect(entry.targetPath).toBe(`plugins/crabcode-security/${entry.targetRelativePath}`);
      expect(entry.sourcePath).toBe(
        `plugins/${upstreamProduct}-security/${entry.sourceRelativePath}`,
      );
      expect(entry.mode === "100644" || entry.mode === "100755").toBe(true);
      expect(Number.isInteger(entry.size) && entry.size >= 0).toBe(true);
      expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(entry.gitBlobSha1).toMatch(/^[0-9a-f]{40}$/);
      const targetBytes = await readFile(path.join(PLUGIN_ROOT, entry.targetRelativePath));
      const targetInfo = await lstat(path.join(PLUGIN_ROOT, entry.targetRelativePath));
      const targetMode = (targetInfo.mode & 0o111) !== 0 ? "100755" : "100644";
      expect(entry.targetSize).toBe(targetBytes.byteLength);
      expect(entry.targetSha256).toBe(createHash("sha256").update(targetBytes).digest("hex"));
      expect(entry.targetMode).toBe(targetMode);
      expect(Array.isArray(entry.changeAxes) && entry.changeAxes.length > 0).toBe(true);
    }

    const canonical = lock.files
      .slice()
      .sort((left: any, right: any) =>
        Buffer.from(left.sourcePath).compare(Buffer.from(right.sourcePath)),
      )
      .map((entry: any) => `${entry.sourcePath}\t${entry.size}\t${entry.sha256}\n`)
      .join("");
    expect(createHash("sha256").update(canonical).digest("hex")).toBe(
      lock.upstream.plugin.manifest.digest,
    );

    const targetCanonical = lock.files
      .slice()
      .sort((left: any, right: any) =>
        Buffer.from(left.targetPath).compare(Buffer.from(right.targetPath)),
      )
      .map(
        (entry: any) =>
          `${entry.targetPath}\t${entry.targetSize}\t${entry.targetSha256}\n`,
      )
      .join("");
    expect(lock.port.targetSnapshot).toMatchObject({
      fileCount: 25,
      byteCount: lock.files.reduce(
        (total: number, entry: any) => total + entry.targetSize,
        0,
      ),
    });
    expect(createHash("sha256").update(targetCanonical).digest("hex")).toBe(
      lock.port.targetSnapshot.manifest.digest,
    );

    const marketplace = JSON.parse(
      await readFile(path.join(REPO_ROOT, ".crabcode-plugin", "marketplace.json"), "utf8"),
    );
    const targetEntries = marketplace.plugins.filter(
      (entry: any) => entry?.name === "crabcode-security",
    );
    expect(targetEntries).toHaveLength(0);
    const stagedEntry = JSON.parse(
      await readFile(
        path.join(PLUGIN_ROOT, "docs", "legal", "TARGET-MARKETPLACE-ENTRY.json"),
        "utf8",
      ),
    );
    const targetEntryCanonical = `${JSON.stringify(sortJson(stagedEntry))}\n`;
    expect(lock.port.targetMarketplace).toMatchObject({
      releaseStatus: "staged-not-active",
      stagedEntryPath:
        "plugins/crabcode-security/docs/legal/TARGET-MARKETPLACE-ENTRY.json",
      canonicalEntry: {
        size: Buffer.byteLength(targetEntryCanonical),
      },
    });
    expect(lock.port.promotionGateSnapshot).toMatchObject({
      activeMarketplacePath: ".crabcode-plugin/marketplace.json",
      selector: {
        expectedMatches: 0,
        observedMatches: 0,
      },
    });
    expect(createHash("sha256").update(targetEntryCanonical).digest("hex")).toBe(
      lock.port.targetMarketplace.canonicalEntry.sha256,
    );

    const replayPatch = await readFile(
      path.join(REPO_ROOT, lock.port.replay.patchPath),
    );
    expect(lock.port.replay).toMatchObject({
      stripComponents: 2,
      expectedResultFileCount: 25,
      patchSize: replayPatch.byteLength,
      patchSha256: createHash("sha256").update(replayPatch).digest("hex"),
      sealResult: {
        status: "passed",
        replayedFileCount: 25,
      },
    });
  });

  test("keeps deterministic Python transforms exact unless a target-only hardening axis is recorded", async () => {
    const lock = JSON.parse(
      await readFile(path.join(PLUGIN_ROOT, "docs", "legal", "SOURCE-LOCK.json"), "utf8"),
    );
    const sourceLower = `c${"laude"}`;
    const sourceTitle = `C${"laude"}`;
    const sourceUpper = `C${"LAUDE"}`;
    const scriptPaths = [
      "scripts/patch_artifacts.py",
      "scripts/render_report.py",
      "scripts/write_scan_meta.py",
    ];

    for (const relative of scriptPaths) {
      const target = await readFile(path.join(PLUGIN_ROOT, relative), "utf8");
      const normalized = target
        .replaceAll("CRABCODE-SECURITY", `${sourceUpper}-SECURITY`)
        .replaceAll(".crabcode-security-run", `.${sourceLower}-security-run`)
        .replaceAll("CrabCode Security", `${sourceTitle} Security`)
        .replaceAll("CrabCode", sourceTitle)
        .replaceAll("crabcode-security", `${sourceLower}-security`);
      const source = lock.files.find((entry: any) => entry.targetRelativePath === relative);
      expect(source).toBeDefined();
      if (source.changeAxes.includes("securityHardening")) {
        expect(createHash("sha256").update(normalized).digest("hex")).not.toBe(
          source.sha256,
        );
      } else {
        expect(Buffer.byteLength(normalized)).toBe(source.size);
        expect(createHash("sha256").update(normalized).digest("hex")).toBe(
          source.sha256,
        );
      }
    }
  });

  test("keeps scan.js exact after inverse branding unless target-only hardening is recorded", async () => {
    const lock = JSON.parse(
      await readFile(path.join(PLUGIN_ROOT, "docs", "legal", "SOURCE-LOCK.json"), "utf8"),
    );
    const relative = "workflows/scan.js";
    const target = await readFile(path.join(PLUGIN_ROOT, relative), "utf8");
    const sourceLower = `c${"laude"}`;
    const sourceTitle = `C${"laude"}`;
    const normalized = target
      .replaceAll("CrabCode", sourceTitle)
      .replaceAll("crabcode", sourceLower);
    const source = lock.files.find((entry: any) => entry.targetRelativePath === relative);

    expect(source).toBeDefined();
    if (source.changeAxes.includes("securityHardening")) {
      expect(createHash("sha256").update(normalized).digest("hex")).not.toBe(
        source.sha256,
      );
    } else {
      expect(Buffer.byteLength(normalized)).toBe(source.size);
      expect(createHash("sha256").update(normalized).digest("hex")).toBe(
        source.sha256,
      );
    }
  });
});
