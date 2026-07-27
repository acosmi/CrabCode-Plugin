import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateVersionConsistency } from "../../src/policy/versionConsistencyValidator.ts";

async function makeTempRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "version-consistency-"));
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value));
}

type PluginSpec = {
  name: string;
  source: string;
  entryVersion?: string;
  manifestVersion?: string | null;
  packageVersion?: string;
  packageName?: string;
};

/** Lays down a marketplace plus each plugin's manifest and optional npm package. */
async function scaffold(root: string, specs: PluginSpec[]): Promise<void> {
  await writeJson(path.join(root, ".crabcode-plugin", "marketplace.json"), {
    plugins: specs.map((s) => ({
      name: s.name,
      source: s.source,
      version: s.entryVersion ?? "1.0.0",
    })),
  });
  for (const s of specs) {
    const dir = s.source === "./" ? root : path.join(root, s.source.replace(/^\.\//, ""));
    if (s.manifestVersion !== null) {
      await writeJson(path.join(dir, ".crabcode-plugin", "plugin.json"), {
        name: s.name,
        version: s.manifestVersion ?? "1.0.0",
      });
    }
    if (s.packageVersion !== undefined) {
      await writeJson(path.join(dir, "package.json"), {
        name: s.packageName ?? s.name,
        version: s.packageVersion,
      });
    }
  }
}

describe("version consistency validator", () => {
  test("passes when all three versions agree", async () => {
    const root = await makeTempRoot();
    await scaffold(root, [
      {
        name: "alpha",
        source: "./plugins/alpha",
        entryVersion: "0.2.0",
        manifestVersion: "0.2.0",
        packageVersion: "0.2.0",
      },
    ]);
    expect(await validateVersionConsistency(root)).toEqual([]);
  });

  test("flags marketplace version drifting from plugin.json", async () => {
    const root = await makeTempRoot();
    await scaffold(root, [
      { name: "alpha", source: "./plugins/alpha", entryVersion: "0.3.0", manifestVersion: "0.2.0" },
    ]);
    const issues = await validateVersionConsistency(root);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe("error");
    expect(issues[0]!.message).toContain("0.3.0");
    expect(issues[0]!.message).toContain("0.2.0");
  });

  test("flags package.json version drifting from plugin.json — the previously unchecked leg", async () => {
    const root = await makeTempRoot();
    await scaffold(root, [
      {
        name: "alpha",
        source: "./plugins/alpha",
        entryVersion: "0.2.0",
        manifestVersion: "0.2.0",
        packageVersion: "0.4.1",
      },
    ]);
    const issues = await validateVersionConsistency(root);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe("error");
    expect(issues[0]!.path).toContain("package.json");
    expect(issues[0]!.message).toContain("0.4.1");
  });

  test("a plugin without package.json skips leg 3 rather than failing", async () => {
    const root = await makeTempRoot();
    await scaffold(root, [
      { name: "alpha", source: "./plugins/alpha", entryVersion: "0.2.0", manifestVersion: "0.2.0" },
    ]);
    expect(await validateVersionConsistency(root)).toEqual([]);
  });

  test("package name may differ from plugin name — only versions are compared", async () => {
    const root = await makeTempRoot();
    await scaffold(root, [
      {
        name: "discord",
        source: "./plugins/discord",
        entryVersion: "0.1.1",
        manifestVersion: "0.1.1",
        packageVersion: "0.1.1",
        packageName: "crabcode-channel-discord",
      },
    ]);
    expect(await validateVersionConsistency(root)).toEqual([]);
  });

  test("resolves source './' to the repo root", async () => {
    const root = await makeTempRoot();
    await scaffold(root, [
      { name: "root-plugin", source: "./", entryVersion: "0.1.0", manifestVersion: "0.1.0", packageVersion: "0.9.0" },
    ]);
    const issues = await validateVersionConsistency(root);
    expect(issues.some((i) => i.message.includes("0.9.0"))).toBe(true);
  });

  test("flags a marketplace entry whose source has no plugin manifest", async () => {
    const root = await makeTempRoot();
    await scaffold(root, [
      { name: "ghost", source: "./plugins/ghost", manifestVersion: null },
    ]);
    const issues = await validateVersionConsistency(root);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain("no plugin manifest");
  });

  test("flags a manifest with no version", async () => {
    const root = await makeTempRoot();
    await writeJson(path.join(root, ".crabcode-plugin", "marketplace.json"), {
      plugins: [{ name: "alpha", source: "./plugins/alpha", version: "0.1.0" }],
    });
    await writeJson(path.join(root, "plugins", "alpha", ".crabcode-plugin", "plugin.json"), {
      name: "alpha",
    });
    const issues = await validateVersionConsistency(root);
    expect(issues.some((i) => i.message.includes("no usable version"))).toBe(true);
  });

  test("flags a non-string marketplace version instead of silently skipping the comparison", async () => {
    // marketplaceValidator's required-field check accepts a numeric version
    // (isNonEmpty treats any non-null as present), so comparison must own the type
    // or the entry passes every gate while being uncomparable.
    const root = await makeTempRoot();
    await writeJson(path.join(root, ".crabcode-plugin", "marketplace.json"), {
      plugins: [{ name: "alpha", source: "./plugins/alpha", version: 1 }],
    });
    await writeJson(path.join(root, "plugins", "alpha", ".crabcode-plugin", "plugin.json"), {
      name: "alpha",
      version: "1.0.0",
    });
    const issues = await validateVersionConsistency(root);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe("error");
    expect(issues[0]!.message).toContain("must be a string");
  });

  test("flags a non-string plugin.json version", async () => {
    const root = await makeTempRoot();
    await writeJson(path.join(root, ".crabcode-plugin", "marketplace.json"), {
      plugins: [{ name: "alpha", source: "./plugins/alpha", version: "1.0.0" }],
    });
    await writeJson(path.join(root, "plugins", "alpha", ".crabcode-plugin", "plugin.json"), {
      name: "alpha",
      version: 1,
    });
    const issues = await validateVersionConsistency(root);
    expect(issues.some((i) => i.severity === "error" && i.message.includes("no usable version"))).toBe(true);
  });

  test("flags unparseable package.json instead of throwing", async () => {
    const root = await makeTempRoot();
    await scaffold(root, [
      { name: "alpha", source: "./plugins/alpha", entryVersion: "0.1.0", manifestVersion: "0.1.0" },
    ]);
    await writeFile(path.join(root, "plugins", "alpha", "package.json"), "{ not json");
    const issues = await validateVersionConsistency(root);
    expect(issues.some((i) => i.message.includes("not valid JSON"))).toBe(true);
  });

  // Driven through an explicit baseline rather than a shipped member: the shipped set
  // is empty (ratcheted 2026-07-27), and naming a member of an emptied baseline is the
  // fixture trap mcp-contract.test.ts documents.
  test("a baselined plugin drifts as a warning, not an error", async () => {
    const root = await makeTempRoot();
    await scaffold(root, [
      { name: "legacy", source: "./plugins/legacy", entryVersion: "0.1.0", manifestVersion: "0.1.0", packageVersion: "0.3.0" },
    ]);
    const issues = await validateVersionConsistency(root, new Set(["legacy"]));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe("warning");
  });

  test("ratchet: a baselined plugin whose versions now agree is a stale-entry error", async () => {
    const root = await makeTempRoot();
    await scaffold(root, [
      { name: "legacy", source: "./plugins/legacy", entryVersion: "0.1.0", manifestVersion: "0.1.0", packageVersion: "0.1.0" },
    ]);
    const issues = await validateVersionConsistency(root, new Set(["legacy"]));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe("error");
    expect(issues[0]!.message).toContain("stale PACKAGE_VERSION_BASELINE");
  });

  test("an unbaselined plugin with the same drift is an error, not a warning", async () => {
    const root = await makeTempRoot();
    await scaffold(root, [
      { name: "legacy", source: "./plugins/legacy", entryVersion: "0.1.0", manifestVersion: "0.1.0", packageVersion: "0.3.0" },
    ]);
    const issues = await validateVersionConsistency(root, new Set());
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe("error");
  });

  test("stays silent when marketplace.json is absent — that is marketplaceValidator's finding", async () => {
    const root = await makeTempRoot();
    expect(await validateVersionConsistency(root)).toEqual([]);
  });

  test("the real repo is clean — no drift at all, baselined or otherwise", async () => {
    // Pins the ratcheted-to-zero state: any new warning means someone re-baselined
    // instead of reconciling, any error means live drift shipped.
    const issues = await validateVersionConsistency(path.resolve("."));
    expect(issues).toEqual([]);
  });
});
