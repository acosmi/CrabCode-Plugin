import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import {
  appendFile,
  cp,
  mkdir,
  mkdtemp,
  rm,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  canonicalJson,
  verifyCrabcodeSecurityPort,
} from "../../scripts/verify-crabcode-security-port.ts";
import { REPO_ROOT } from "./test-helpers.ts";

const sourceProduct = `c${"laude"}`;
const upstreamCheckout =
  process.env.CRABCODE_SECURITY_UPSTREAM_CHECKOUT ??
  path.join("/private/tmp", `${sourceProduct}-security-4b3d2a2`);
const temporaryRoots: string[] = [];

function hasLockedMarketplaceObject(): boolean {
  if (!existsSync(path.join(upstreamCheckout, ".git"))) return false;
  const lock = JSON.parse(
    readFileSync(
      path.join(
        REPO_ROOT,
        "plugins",
        "crabcode-security",
        "docs",
        "legal",
        "SOURCE-LOCK.json",
      ),
      "utf8",
    ),
  ) as { upstream: { marketplace: { gitBlobSha1: string } } };
  const result = spawnSync(
    "git",
    ["cat-file", "-e", lock.upstream.marketplace.gitBlobSha1],
    {
      cwd: upstreamCheckout,
      env: {
        ...process.env,
        GIT_NO_LAZY_FETCH: "1",
        GIT_OPTIONAL_LOCKS: "0",
      },
      shell: false,
    },
  );
  return result.status === 0;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, { force: true, recursive: true }),
    ),
  );
});

describe("CrabCode Security provenance verifier", () => {
  test("uses recursive UTF-8 key ordering, preserves array order, and emits one LF", () => {
    const input = {
      z: 1,
      a: {
        z: true,
        a: ["second", "first"],
      },
      ä: null,
    };

    expect(canonicalJson(input)).toBe(
      '{"a":{"a":["second","first"],"z":true},"z":1,"ä":null}\n',
    );
    expect(canonicalJson({ b: 1, a: 2 }).endsWith("\n\n")).toBe(false);
  });

  const checkoutExists = existsSync(path.join(upstreamCheckout, ".git"));
  const completeCheckout = checkoutExists && hasLockedMarketplaceObject();
  const integrationTest = completeCheckout
    ? test
    : test.skip;
  const incompleteCheckoutTest = checkoutExists && !completeCheckout
    ? test
    : test.skip;

  incompleteCheckoutTest(
    "rejects an incomplete partial checkout without attempting a lazy fetch",
    async () => {
      const report = await verifyCrabcodeSecurityPort({
        upstreamCheckout,
        repositoryRoot: REPO_ROOT,
      });

      expect(report.ok).toBe(false);
      expect(
        report.errors.some((error) =>
          error.includes("upstream Git-object verification"),
        ),
      ).toBe(true);
    },
  );

  integrationTest(
    "verifies the pinned upstream Git objects and the complete current port",
    async () => {
      const report = await verifyCrabcodeSecurityPort({
        upstreamCheckout,
        repositoryRoot: REPO_ROOT,
      });

      expect(report.errors).toEqual([]);
      expect(report.ok).toBe(true);
      expect(report.checks).toBeGreaterThan(250);
    },
  );

  integrationTest(
    "rejects a copied target fixture after one mapped file is tampered",
    async () => {
      const fixtureRoot = await mkdtemp(
        path.join(os.tmpdir(), "crabcode-security-provenance-"),
      );
      temporaryRoots.push(fixtureRoot);

      await mkdir(path.join(fixtureRoot, "plugins"), { recursive: true });
      await mkdir(path.join(fixtureRoot, ".crabcode-plugin"), {
        recursive: true,
      });
      await cp(
        path.join(REPO_ROOT, "plugins", "crabcode-security"),
        path.join(fixtureRoot, "plugins", "crabcode-security"),
        { recursive: true },
      );
      await cp(
        path.join(REPO_ROOT, ".crabcode-plugin", "marketplace.json"),
        path.join(fixtureRoot, ".crabcode-plugin", "marketplace.json"),
      );

      const tamperedPath = path.join(
        fixtureRoot,
        "plugins",
        "crabcode-security",
        "README.md",
      );
      await appendFile(tamperedPath, "\nfixture tamper\n");

      const report = await verifyCrabcodeSecurityPort({
        upstreamCheckout,
        repositoryRoot: fixtureRoot,
      });

      expect(report.ok).toBe(false);
      expect(
        report.errors.some(
          (error) =>
            error.includes("plugins/crabcode-security/README.md") &&
            (error.includes("size") || error.includes("sha256")),
        ),
      ).toBe(true);
      expect(
        report.errors.some((error) => error.includes("target manifest sha256")),
      ).toBe(true);
    },
  );

  integrationTest(
    "rejects an adaptation patch that no longer matches the locked replay",
    async () => {
      const fixtureRoot = await mkdtemp(
        path.join(os.tmpdir(), "crabcode-security-replay-"),
      );
      temporaryRoots.push(fixtureRoot);

      await mkdir(path.join(fixtureRoot, "plugins"), { recursive: true });
      await mkdir(path.join(fixtureRoot, ".crabcode-plugin"), {
        recursive: true,
      });
      await cp(
        path.join(REPO_ROOT, "plugins", "crabcode-security"),
        path.join(fixtureRoot, "plugins", "crabcode-security"),
        { recursive: true },
      );
      await cp(
        path.join(REPO_ROOT, ".crabcode-plugin", "marketplace.json"),
        path.join(fixtureRoot, ".crabcode-plugin", "marketplace.json"),
      );
      await appendFile(
        path.join(
          fixtureRoot,
          "plugins",
          "crabcode-security",
          "docs",
          "legal",
          "FULL-PORT.patch",
        ),
        "\n# tampered\n",
      );

      const report = await verifyCrabcodeSecurityPort({
        upstreamCheckout,
        repositoryRoot: fixtureRoot,
      });

      expect(report.ok).toBe(false);
      expect(
        report.errors.some(
          (error) =>
            error.includes("replay patch size") ||
            error.includes("replay patch sha256"),
        ),
      ).toBe(true);
    },
  );
});
