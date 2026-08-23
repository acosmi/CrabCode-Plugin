import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const fixtureScript = join(root, "scripts", "verify-mcp-upgrade-restart-fixture.ts");

type FixtureReport = {
  assertions: {
    oldInstallRemainsPresentOnlyAsOrphan: boolean;
    oldProcessRemainsRemotePositiveUntilRestart: boolean;
    restartedActiveRemoteCount: number;
    restartActivatesSafeLocalStdioOnly: boolean;
  };
  cleanup: { temporaryWorkspaceRemoved: boolean };
  evidenceComposition: {
    directHostCodeExecuted: boolean;
    fixtureClaim: string;
    hostSuiteCompanionEvidence: string;
  };
  evidenceKind: string;
  git: {
    archiveMechanism: string;
    oldPublic: { commit: string; tree: string };
    safeHead: { commit: string; tree: string };
  };
  lifecycle: {
    processA: {
      afterRegistrySwitch: {
        activeInventory: { transports: { remote: number } };
        frozenRegistryGeneration: number;
        observedRegistry: { generation: number };
        pid: number;
      };
      startup: {
        activeInventory: { transports: { http: number; remote: number; sse: number } };
        pid: number;
      };
    };
    processB: {
      activeInventory: {
        configSurfaces: string[];
        serverCount: number;
        transports: {
          http: number;
          localStdio: number;
          remote: number;
          sse: number;
          stdio: number;
        };
      };
      observedRegistry: { generation: number };
      orphanPresence: Array<{ exists: boolean }>;
      pid: number;
    };
  };
  schemaVersion: number;
};

describe("old-to-safe MCP restart fixture", () => {
  test(
    "uses real Git bytes and a distinct post-restart process",
    () => {
      const result = spawnSync(process.execPath, [fixtureScript], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, TZ: "UTC" },
        timeout: 60_000,
      });
      expect(
        result.status,
        `fixture stderr:\n${result.stderr}\nfixture stdout:\n${result.stdout}`,
      ).toBe(0);

      const report = JSON.parse(result.stdout) as FixtureReport;
      expect(report.schemaVersion).toBe(1);
      expect(report.evidenceKind).toBe("real-git-bytes-plus-dual-process-fixture");
      expect(report.git.archiveMechanism).toBe("git archive --format=tar");
      expect(report.git.oldPublic.commit).toBe(
        "2e0b1266dcc4c34f8930cd589ce7aaedd6aa0f10",
      );
      expect(report.git.oldPublic.tree).toMatch(/^[0-9a-f]{40}$/);
      expect(report.git.safeHead.commit).toMatch(/^[0-9a-f]{40}$/);
      expect(report.git.safeHead.tree).toMatch(/^[0-9a-f]{40}$/);

      const processA = report.lifecycle.processA;
      expect(processA.startup.activeInventory.transports.http).toBeGreaterThan(0);
      expect(processA.startup.activeInventory.transports.sse).toBeGreaterThan(0);
      expect(processA.startup.activeInventory.transports.remote).toBeGreaterThan(0);
      expect(processA.afterRegistrySwitch.pid).toBe(processA.startup.pid);
      expect(processA.afterRegistrySwitch.frozenRegistryGeneration).toBe(1);
      expect(processA.afterRegistrySwitch.observedRegistry.generation).toBe(2);
      expect(processA.afterRegistrySwitch.activeInventory.transports.remote).toBeGreaterThan(0);

      const processB = report.lifecycle.processB;
      expect(processB.pid).not.toBe(processA.startup.pid);
      expect(processB.observedRegistry.generation).toBe(2);
      expect(processB.activeInventory.configSurfaces).toEqual([
        "crabcode-html-video:plugins/crabcode-html-video/.mcp.json",
      ]);
      expect(processB.activeInventory.serverCount).toBe(1);
      expect(processB.activeInventory.transports).toMatchObject({
        http: 0,
        localStdio: 1,
        remote: 0,
        sse: 0,
        stdio: 1,
      });
      expect(processB.orphanPresence).toHaveLength(1);
      expect(processB.orphanPresence[0]?.exists).toBe(true);

      expect(report.evidenceComposition.directHostCodeExecuted).toBe(false);
      expect(report.evidenceComposition.fixtureClaim).toContain("two concurrent OS processes");
      expect(report.evidenceComposition.hostSuiteCompanionEvidence).toContain("57-test");
      expect(report.assertions).toEqual({
        oldProcessRemainsRemotePositiveUntilRestart: true,
        restartActivatesSafeLocalStdioOnly: true,
        restartedActiveRemoteCount: 0,
        oldInstallRemainsPresentOnlyAsOrphan: true,
      });
      expect(report.cleanup.temporaryWorkspaceRemoved).toBe(true);
    },
    60_000,
  );

  test("fetches full history in the manually dispatched root CI job", () => {
    const workflow = readFileSync(join(root, ".github", "workflows", "ci.yml"), "utf8");
    expect(workflow).toContain("Checkout full history for the old-to-safe MCP fixture");
    expect(workflow).toContain("fetch-depth: 0");
  });
});
