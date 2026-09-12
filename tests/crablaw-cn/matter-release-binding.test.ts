import { beforeAll, describe, expect, test } from "bun:test";
import { appendFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  makeValidRun,
  readJson,
  readSources,
  runPython,
  sha256,
  writeJson,
  writeSources,
  type RunFixture,
} from "./matterFixture.ts";

const HEX64 = /^[a-f0-9]{64}$/;
// The sentence sync_run_manifest.py writes and finalize_run.py retires. The first
// test below reads it back off a real sync, so this literal cannot drift unnoticed.
const BINDING_REASON_PREFIX = "review decisions no longer bind to the current bytes";

function manifestPath(fixture: RunFixture): string {
  return path.join(fixture.runDir, "run-manifest.json");
}

function reviewItemPath(fixture: RunFixture): string {
  return path.join(fixture.runDir, "review-queue-item.json");
}

function finalize(fixture: RunFixture, subcommand: string, extra: string[] = []) {
  return runPython("finalize_run.py", [
    subcommand,
    "--root", fixture.root,
    "--matter-id", "demo-matter",
    "--run-id", "run-001",
    ...extra,
  ]);
}

function validateRun(fixture: RunFixture, extra: string[] = []) {
  return runPython("validate_run.py", [
    "--root", fixture.root,
    "--matter-id", "demo-matter",
    "--run-id", "run-001",
    ...extra,
  ]);
}

function syncRun(fixture: RunFixture) {
  return runPython("sync_run_manifest.py", [
    "--root", fixture.root,
    "--matter-id", "demo-matter",
    "--run-id", "run-001",
    "--apply",
  ]);
}

/**
 * Move the review-queue item the way the review-queue skill would, keeping the
 * manifest honest about it: the item's artifact hash is refreshed and a run that
 * has been reviewed is no longer "ready for review". `refreshArtifact: false`
 * simulates an item edited behind the manifest's back.
 */
async function setReviewItem(
  fixture: RunFixture,
  patch: Record<string, unknown>,
  options: { refreshArtifact?: boolean } = {},
): Promise<void> {
  const item = await readJson(reviewItemPath(fixture));
  Object.assign(item, patch);
  await writeJson(reviewItemPath(fixture), item);
  if (options.refreshArtifact === false) {
    return;
  }
  const manifest = await readJson(manifestPath(fixture));
  for (const artifact of manifest.artifacts) {
    if (artifact.type === "review-item") {
      artifact.sha256 = await sha256(reviewItemPath(fixture));
    }
  }
  if (manifest.status === "ready-for-review" && item.status !== "pending-review") {
    manifest.status = "reviewed-internal";
  }
  await writeJson(manifestPath(fixture), manifest);
}

async function approveInternally(fixture: RunFixture): Promise<void> {
  await setReviewItem(fixture, {
    status: "approved-internal",
    reviewer: "王律师",
    reviewedAt: "2026-09-12",
    decisionActor: "manual-lawyer-review",
  });
}

function recordLawyerReview(fixture: RunFixture, by = "王律师") {
  return finalize(fixture, "record", ["--kind", "lawyer-reviewed", "--by", by]);
}

function statusOf(fixture: RunFixture): any {
  const result = finalize(fixture, "status");
  expect(result.exitCode, result.stdout + result.stderr).toBe(0);
  return JSON.parse(result.stdout);
}

describe("a review decision binds to the bytes it approved", () => {
  let fixture: RunFixture;

  beforeAll(async () => {
    fixture = await makeValidRun();
    await approveInternally(fixture);
  });

  test("T44: recording a lawyer review binds it to the current digest and opens the gate", () => {
    const recorded = recordLawyerReview(fixture);
    expect(recorded.exitCode, recorded.stdout + recorded.stderr).toBe(0);
    const payload = JSON.parse(recorded.stdout);
    expect(payload.status).toBe("recorded");
    expect(payload.decisionId).toBe("decision-lawyer-reviewed-0002");

    const state = statusOf(fixture);
    expect(state.releaseCapability).toBe("lawyer-reviewed");
    expect(state.reviewState).toBe("lawyer-reviewed");
    expect(state.decisions.length).toBe(1);
    expect(state.decisions[0].effective).toBe(true);
    expect(state.decisions[0].decidedBy).toBe("王律师");
    expect(state.decisions[0].boundDigest).toMatch(HEX64);
    expect(state.drift).toEqual({ documents: [], sources: [], artifacts: [] });

    const gated = finalize(fixture, "gate", ["--require", "lawyer-reviewed"]);
    expect(gated.exitCode, gated.stdout).toBe(0);
    const validated = validateRun(fixture, ["--strict"]);
    expect(validated.exitCode, validated.stderr).toBe(0);
  });

  test("T44: the decision is written into the manifest as append-only history", async () => {
    const manifest = await readJson(manifestPath(fixture));
    expect(manifest.reviewState).toBe("lawyer-reviewed");
    expect(manifest.externalRelease).toBe("pending-explicit-approval");
    expect(manifest.reviewDecisions.length).toBe(1);
    const decision = manifest.reviewDecisions[0];
    expect(decision.kind).toBe("lawyer-reviewed");
    expect(decision.reviewItemId).toBe("review-run-001");
    expect(decision.boundRevision).toBe(manifest.revision);
    expect(decision.boundDigest).toMatch(HEX64);
  });

  test("T40: changing a document invalidates the decision before any sync runs", async () => {
    await writeFile(fixture.inputPath, "用户提供：交付期限改为2026年8月20日。\n");

    const state = statusOf(fixture);
    expect(state.drift.documents).toContain("doc-agreement");
    expect(state.releaseCapability).toBe("prohibited");
    expect(state.decisions[0].effective).toBe(false);

    const gated = finalize(fixture, "gate", ["--require", "lawyer-reviewed"]);
    expect(gated.exitCode).toBe(3);
    expect(JSON.parse(gated.stdout).reasons.join("\n")).toContain("doc-agreement");

    // Non-strict validation is enough: the approval claim is refused on its own.
    const validated = validateRun(fixture);
    expect(validated.exitCode).toBe(1);
    expect(validated.stderr).toContain("no review decision bound to the current bytes");
  });

  test("T40: sync drops the approval fields and keeps the decision history", async () => {
    const synced = syncRun(fixture);
    expect(synced.exitCode, synced.stdout).toBe(0);
    const result = JSON.parse(synced.stdout);
    expect(result.status).toBe("apply-ready");
    expect(result.reviewState).toBe("not-ready");
    expect(result.externalRelease).toBe("prohibited");

    const manifest = await readJson(manifestPath(fixture));
    expect(manifest.reviewState).toBe("not-ready");
    expect(manifest.externalRelease).toBe("prohibited");
    expect(manifest.blockingReasons.join("\n")).toContain("no longer bind to the current bytes");
    expect(manifest.reviewDecisions.length).toBe(1);

    // A second apply finds nothing new, so it must not restate the reason.
    const again = syncRun(fixture);
    expect(again.exitCode, again.stdout).toBe(0);
    expect(JSON.parse(again.stdout).status).toBe("unchanged");
    const after = await readJson(manifestPath(fixture));
    expect(after.blockingReasons).toEqual(manifest.blockingReasons);
    expect(after.reviewDecisions.length).toBe(1);
  });
});

describe("approval strings never certify themselves", () => {
  test("T36: a hand-written approved manifest is refused by the validator and the gate", async () => {
    const fixture = await makeValidRun();
    const manifest = await readJson(manifestPath(fixture));
    manifest.reviewState = "lawyer-reviewed";
    manifest.externalRelease = "approved";
    await writeJson(manifestPath(fixture), manifest);

    const validated = validateRun(fixture);
    expect(validated.exitCode).toBe(1);
    expect(validated.stderr).toContain("no review decision bound to the current bytes");
    expect(validated.stderr).toContain("external release approval is not bound to the current bytes");

    const gated = finalize(fixture, "gate", ["--require", "approved-external"]);
    expect(gated.exitCode).toBe(3);
    expect(JSON.parse(gated.stdout).releaseCapability).toBe("internal-draft");
  });

  test("T36 positive control: the same run passes once both decisions are recorded", async () => {
    const fixture = await makeValidRun();
    await approveInternally(fixture);
    const internal = recordLawyerReview(fixture);
    expect(internal.exitCode, internal.stdout + internal.stderr).toBe(0);

    await setReviewItem(fixture, {
      status: "approved-external",
      externalDestination: "客户指定邮箱",
    });
    const external = finalize(fixture, "record", [
      "--kind", "approved-external",
      "--by", "王律师",
      "--note", "经王律师确认可外发",
    ]);
    expect(external.exitCode, external.stdout + external.stderr).toBe(0);

    const manifest = await readJson(manifestPath(fixture));
    expect(manifest.externalRelease).toBe("approved");
    expect(manifest.reviewDecisions.length).toBe(2);
    expect(manifest.reviewDecisions[1].destination).toBe("客户指定邮箱");
    expect(manifest.reviewDecisions[1].note).toBe("经王律师确认可外发");

    const validated = validateRun(fixture, ["--strict"]);
    expect(validated.exitCode, validated.stderr).toBe(0);
    const gated = finalize(fixture, "gate", ["--require", "approved-external"]);
    expect(gated.exitCode, gated.stdout).toBe(0);
    expect(JSON.parse(gated.stdout).releaseCapability).toBe("approved-external");
    // An external approval also satisfies the weaker internal requirement.
    expect(finalize(fixture, "gate", ["--require", "lawyer-reviewed"]).exitCode).toBe(0);
  });
});

describe("a decision cannot be recorded without the human record behind it", () => {
  test("a pending-review queue item cannot be bound as a lawyer review", async () => {
    const fixture = await makeValidRun();
    const recorded = recordLawyerReview(fixture);
    expect(recorded.exitCode, recorded.stdout).toBe(5);
    expect(JSON.parse(recorded.stdout).error).toContain("does not record a lawyer decision");
  });

  test("external release cannot be recorded before an effective lawyer review", async () => {
    const fixture = await makeValidRun();
    await setReviewItem(fixture, {
      status: "approved-external",
      reviewer: "王律师",
      reviewedAt: "2026-09-12",
      decisionActor: "manual-lawyer-review",
      externalDestination: "客户指定邮箱",
    });
    const recorded = finalize(fixture, "record", ["--kind", "approved-external", "--by", "王律师"]);
    expect(recorded.exitCode, recorded.stdout).toBe(5);
    expect(JSON.parse(recorded.stdout).error).toContain("requires an effective lawyer-reviewed decision");
  });

  test("someone the matter does not know cannot record a decision at all", async () => {
    const fixture = await makeValidRun();
    await approveInternally(fixture);

    const stranger = recordLawyerReview(fixture, "陌生人");
    expect(stranger.exitCode, stranger.stdout).toBe(7);
    expect(JSON.parse(stranger.stdout).error).toContain(
      "is not an allowed user / review owner of matter demo-matter",
    );
    expect(await readJson(manifestPath(fixture))).not.toHaveProperty("reviewDecisions");

    // Positive control: the matter's review owner is known to it and is accepted.
    const owner = recordLawyerReview(fixture, "王律师");
    expect(owner.exitCode, owner.stdout).toBe(0);
  });

  test("the decision maker cannot differ from the recorded reviewer", async () => {
    const fixture = await makeValidRun();
    await approveInternally(fixture);
    const recorded = recordLawyerReview(fixture, "张律师");
    expect(recorded.exitCode, recorded.stdout).toBe(6);
    expect(JSON.parse(recorded.stdout).error).toContain("is not the reviewer recorded");

    // Positive control: the reviewer named on the item is accepted.
    expect(recordLawyerReview(fixture, "王律师").exitCode).toBe(0);
  });

  test("a run that fails strict validation cannot have a decision recorded", async () => {
    const fixture = await makeValidRun();
    await approveInternally(fixture);
    // The item moves again without the manifest being told. The binding digest
    // ignores the review item on purpose, so only the real validator catches this.
    await setReviewItem(fixture, { decisionNotes: "补充复核意见" }, { refreshArtifact: false });

    const recorded = recordLawyerReview(fixture);
    expect(recorded.exitCode, recorded.stdout).toBe(4);
    const payload = JSON.parse(recorded.stdout);
    expect(payload.errors.join("\n")).toContain("artifact review-item sha256 does not match");

    // Positive control: the same call succeeds once the manifest is truthful again.
    await setReviewItem(fixture, {});
    expect(recordLawyerReview(fixture).exitCode).toBe(0);
  });

  test("a stale run refuses to record a decision at all", async () => {
    const fixture = await makeValidRun();
    await approveInternally(fixture);
    await writeFile(fixture.inputPath, "用户提供：材料被替换。\n");
    expect(syncRun(fixture).exitCode).toBe(0);
    const manifest = await readJson(manifestPath(fixture));
    expect(manifest.status).toBe("stale");

    const recorded = recordLawyerReview(fixture);
    expect(recorded.exitCode, recorded.stdout).toBe(3);
    expect(JSON.parse(recorded.stdout).reasons.join("\n")).toContain("stale");
  });
});

describe("a fresh decision answers the reason the downgrade left behind", () => {
  async function markIssueReanalyzed(fixture: RunFixture): Promise<void> {
    const file = path.join(fixture.runDir, "issue-tree.json");
    const issueTree = await readJson(file);
    issueTree.issues[0].status = "resolved-internal";
    await writeJson(file, issueTree);
  }

  test("re-analysing and recording again clears it, and leaves every other reason alone", async () => {
    const fixture = await makeValidRun();
    await approveInternally(fixture);
    expect(recordLawyerReview(fixture).exitCode).toBe(0);

    await writeFile(fixture.inputPath, "用户提供：交付期限改为2026年8月20日。\n");
    expect(syncRun(fixture).exitCode).toBe(0);
    const downgraded = await readJson(manifestPath(fixture));
    expect(downgraded.reviewState).toBe("not-ready");
    expect(
      downgraded.blockingReasons.some((reason: string) => reason.startsWith(BINDING_REASON_PREFIX)),
    ).toBe(true);

    // Re-analysis: the source record is re-registered against the new bytes and the
    // issue tree records the rerun, then sync absorbs both.
    const rows = await readSources(fixture);
    rows.find((row) => row.sourceId === "src-document")!.contentHash = await sha256(fixture.inputPath);
    await writeSources(fixture, rows);
    await markIssueReanalyzed(fixture);
    expect(syncRun(fixture).exitCode).toBe(0);
    await markIssueReanalyzed(fixture);
    const settled = syncRun(fixture);
    expect(settled.exitCode, settled.stdout).toBe(0);
    expect(JSON.parse(settled.stdout).staleIssueIds).toEqual([]);

    const ready = await readJson(manifestPath(fixture));
    ready.status = "reviewed-internal";
    ready.blockingReasons = [...ready.blockingReasons, "等待客户补充实际交付记录"];
    await writeJson(manifestPath(fixture), ready);

    const recorded = recordLawyerReview(fixture);
    expect(recorded.exitCode, recorded.stdout).toBe(0);
    const after = await readJson(manifestPath(fixture));
    expect(after.reviewState).toBe("lawyer-reviewed");
    expect(after.blockingReasons).toEqual(["等待客户补充实际交付记录"]);
  });

  test("the field disappears when nothing else was blocking", async () => {
    const fixture = await makeValidRun();
    await approveInternally(fixture);
    const manifest = await readJson(manifestPath(fixture));
    manifest.blockingReasons = [`${BINDING_REASON_PREFIX} (revision 3)`];
    await writeJson(manifestPath(fixture), manifest);

    expect(recordLawyerReview(fixture).exitCode).toBe(0);
    expect(await readJson(manifestPath(fixture))).not.toHaveProperty("blockingReasons");
  });
});

describe("the writer lock and an interrupted matter stop a decision from being written", () => {
  test("a live writer lock makes record back off instead of writing", async () => {
    const fixture = await makeValidRun();
    await approveInternally(fixture);
    const lockPath = path.join(fixture.matterDir, ".writer.lock");
    // No pid/host means the lock cannot be proved abandoned, so it is respected.
    await writeFile(lockPath, "held by test\n");

    const blocked = recordLawyerReview(fixture);
    expect(blocked.exitCode, blocked.stdout).toBe(10);
    expect(JSON.parse(blocked.stdout).error).toContain("locked");
    expect(await readJson(manifestPath(fixture))).not.toHaveProperty("reviewDecisions");

    // Positive control: the same call succeeds once the lock is gone.
    await rm(lockPath);
    expect(recordLawyerReview(fixture).exitCode).toBe(0);
  });

  test("an interrupted bootstrap blocks record and gate, while status still answers", async () => {
    const fixture = await makeValidRun();
    await approveInternally(fixture);
    await writeFile(path.join(fixture.matterDir, ".pending"), "");

    const recorded = recordLawyerReview(fixture);
    expect(recorded.exitCode, recorded.stdout).toBe(2);
    expect(JSON.parse(recorded.stdout).error).toContain("matter is pending (incomplete bootstrap)");
    const gated = finalize(fixture, "gate", ["--require", "lawyer-reviewed"]);
    expect(gated.exitCode).toBe(2);

    // `status` only reports, so it answers in JSON and never in the exit code.
    const reported = finalize(fixture, "status");
    expect(reported.exitCode, reported.stdout).toBe(0);
    expect(JSON.parse(reported.stdout).status).toBe("failed");

    // Positive control: clearing the marker unblocks all three.
    await rm(path.join(fixture.matterDir, ".pending"));
    expect(recordLawyerReview(fixture).exitCode).toBe(0);
    expect(finalize(fixture, "gate", ["--require", "lawyer-reviewed"]).exitCode).toBe(0);
    expect(statusOf(fixture).releaseCapability).toBe("lawyer-reviewed");
  });
});

describe("the bound digest covers exactly the dependencies, no more and no less", () => {
  test("a forged boundDigest is rejected, and the real one still passes", async () => {
    const fixture = await makeValidRun();
    await approveInternally(fixture);
    expect(recordLawyerReview(fixture).exitCode).toBe(0);

    const manifest = await readJson(manifestPath(fixture));
    const authentic = manifest.reviewDecisions[0].boundDigest;
    manifest.reviewDecisions[0].boundDigest = "a".repeat(64);
    await writeJson(manifestPath(fixture), manifest);
    const forged = validateRun(fixture);
    expect(forged.exitCode).toBe(1);
    expect(forged.stderr).toContain("no review decision bound to the current bytes");

    manifest.reviewDecisions[0].boundDigest = authentic;
    await writeJson(manifestPath(fixture), manifest);
    const restored = validateRun(fixture);
    expect(restored.exitCode, restored.stderr).toBe(0);
  });

  test("a decision claiming a revision ahead of the manifest is rejected", async () => {
    const fixture = await makeValidRun();
    await approveInternally(fixture);
    expect(recordLawyerReview(fixture).exitCode).toBe(0);

    const manifest = await readJson(manifestPath(fixture));
    manifest.reviewDecisions[0].boundRevision = manifest.revision + 5;
    await writeJson(manifestPath(fixture), manifest);
    const forged = validateRun(fixture);
    expect(forged.exitCode).toBe(1);
    expect(forged.stderr).toContain("is ahead of the manifest revision");
  });

  test("editing the review-queue item leaves the decision effective, editing the memo does not", async () => {
    const fixture = await makeValidRun();
    await approveInternally(fixture);
    expect(recordLawyerReview(fixture).exitCode).toBe(0);

    // The item changes *because* it was decided on, so it is outside the digest.
    await setReviewItem(
      fixture,
      { decisionNotes: "已内部批准，等待外发决定" },
      { refreshArtifact: false },
    );
    const afterItemEdit = statusOf(fixture);
    expect(afterItemEdit.decisions[0].effective).toBe(true);
    expect(afterItemEdit.drift.artifacts).toEqual([]);
    expect(afterItemEdit.releaseCapability).toBe("lawyer-reviewed");

    // Negative control: every other artifact is inside the digest.
    await appendFile(path.join(fixture.matterDir, "outputs", "run-001-memo.md"), "追加一段结论。\n");
    const afterMemoEdit = statusOf(fixture);
    expect(afterMemoEdit.drift.artifacts).toContain("memo");
    expect(afterMemoEdit.decisions[0].effective).toBe(false);
    expect(afterMemoEdit.releaseCapability).toBe("prohibited");
  });

  test("editing a source record invalidates the decision even though no document changed", async () => {
    const fixture = await makeValidRun();
    await approveInternally(fixture);
    expect(recordLawyerReview(fixture).exitCode).toBe(0);

    const rows = (await Bun.file(fixture.sourcesPath).text())
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
    rows.find((row) => row.sourceId === "src-law")!.effectiveStatus = "合成测试记录已被后续修订取代";
    await writeFile(fixture.sourcesPath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);

    const state = statusOf(fixture);
    expect(state.drift.sources).toContain("src-law");
    expect(state.drift.documents).toEqual([]);
    expect(state.decisions[0].effective).toBe(false);
    expect(finalize(fixture, "gate", ["--require", "lawyer-reviewed"]).exitCode).toBe(3);
  });
});
