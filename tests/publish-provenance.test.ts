// W-PUBLISH-PROVENANCE-GATE PR-1（2026-08-17）—— 发布来源门的负向对照。
//
// 立项真源：acosmi/crabcode-source
// `docs/audit/2026-08-17-发布来源门缺失-立项审计与实施路径.md`
//
// 被测的命题只有一句：**发布器与审计器必须用同一条规则算出同一个答案。**
// 在此之前，发布器发的是 `${GITHUB_SHA}`（此刻是什么就发什么、零绿门），而审计器
// 只接受绿 SHA —— 生产侧无门、消费侧要门，是这条链坏过三次的形状。
//
// 这些用例是**负向对照**：每一条都必须能在「改回旧形态」时当场红。只断言
// 「现在是对的」的测试证明不了闸门承重（正例在 bug 存在的世界里往往同样绿）。
//
// 为什么 TS 测试里 spawn python：两条 workflow 里所有脚本历来都是 python3 heredoc，
// 选择器抽出来时保持同一语言 = 零新依赖（ubuntu runner 自带 python3，无需 setup 步）；
// 而本仓的测试入口是 `bun test ./tests/`（verify job，也是 8 条必过检查之一）。
// 把用例放进已存在的 job 是刻意的：required status checks 是**逐条枚举**的，新起一个
// job 不会自动变成必过项 —— 那样的闸门看起来在、实际不挡任何合并。

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SELECTOR = path.join(root, ".crabcode-plugin", "latest-green-main.py");
const VERIFIER = path.join(root, ".crabcode-plugin", "verify-mirror-bundle.py");
const PUBLISHER = path.join(root, ".github", "workflows", "publish-to-cn-mirror.yml");
const AUDITOR = path.join(root, ".github", "workflows", "notify-mirror.yml");

function pythonBin(): string {
  for (const candidate of ["python3", "python"]) {
    const probe = spawnSync(candidate, ["--version"], { encoding: "utf8" });
    if (probe.status === 0) return candidate;
  }
  // 刻意不 skip：跑不动就说跑不动。静默跳过的用例与通过的用例在报告里长得一样。
  throw new Error("找不到 python3/python —— 选择器用例需要它（CI 的 ubuntu runner 自带）");
}

const PY = pythonBin();

function run(args: string[]): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(PY, args, { encoding: "utf8" });
  return {
    status: result.status ?? -1,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);
const SHA_C = "c".repeat(40);

function greenRun(sha: string, createdAt: string, extra: Record<string, unknown> = {}) {
  return {
    status: "completed",
    conclusion: "success",
    event: "push",
    head_branch: "main",
    head_sha: sha,
    created_at: createdAt,
    updated_at: createdAt,
    html_url: `https://example.invalid/${sha.slice(0, 7)}`,
    ...extra,
  };
}

function withRuns(runs: unknown[], body: (runsPath: string, dir: string) => void) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "provenance-"));
  const runsPath = path.join(dir, "runs.json");
  writeFileSync(runsPath, JSON.stringify({ workflow_runs: runs }), "utf8");
  body(runsPath, dir);
}

describe("latest-green-main.py —— 「发哪个 commit」的唯一判据", () => {
  test("HEAD 红、上一个 commit 绿 ⇒ 选上一个绿（不是 HEAD）", () => {
    withRuns(
      [
        { ...greenRun(SHA_C, "2026-08-17T12:00:00Z"), conclusion: "failure" },
        greenRun(SHA_B, "2026-08-17T11:00:00Z"),
        greenRun(SHA_A, "2026-08-17T10:00:00Z"),
      ],
      (runsPath) => {
        const result = run([SELECTOR, "--runs", runsPath]);
        expect(result.status).toBe(0);
        expect(result.stdout.split(/\s+/)[0]).toBe(SHA_B);
      },
    );
  });

  test("最近 100 次全红 ⇒ fail-closed，绝不兜底发 HEAD", () => {
    withRuns(
      Array.from({ length: 100 }, (_, index) => ({
        ...greenRun(SHA_A, `2026-08-17T${String(index % 24).padStart(2, "0")}:00:00Z`),
        conclusion: "failure",
      })),
      (runsPath) => {
        const result = run([SELECTOR, "--runs", runsPath]);
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("no successful main push CI run");
      },
    );
  });

  test("PR 上的绿 / 非 main 分支的绿都不算绿（四条判据缺一不可）", () => {
    for (const broken of [
      { event: "pull_request" },
      { head_branch: "feature/x" },
      { status: "in_progress" },
      { head_sha: "not-a-sha" },
    ]) {
      withRuns([greenRun(SHA_A, "2026-08-17T10:00:00Z", broken)], (runsPath) => {
        const result = run([SELECTOR, "--runs", runsPath]);
        expect({ broken, status: result.status }).toEqual({ broken, status: 1 });
      });
    }
  });

  test("--extra-run 把触发本次发布的那条 run 并进候选（消掉 REST 最终一致性缝隙）", () => {
    withRuns([greenRun(SHA_A, "2026-08-17T10:00:00Z")], (runsPath, dir) => {
      // 前提自检：没有 --extra-run 时选出的是旧的那个 —— 否则这条用例在
      // 「--extra-run 根本没被读」的世界里同样绿。
      expect(run([SELECTOR, "--runs", runsPath]).stdout.split(/\s+/)[0]).toBe(SHA_A);

      const extraPath = path.join(dir, "trigger.json");
      writeFileSync(extraPath, JSON.stringify(greenRun(SHA_C, "2026-08-17T13:00:00Z")), "utf8");
      const merged = run([SELECTOR, "--runs", runsPath, "--extra-run", extraPath]);
      expect(merged.status).toBe(0);
      expect(merged.stdout.split(/\s+/)[0]).toBe(SHA_C);
    });
  });

  test("--extra-run 为 null（workflow_dispatch 那条腿）时静默忽略", () => {
    withRuns([greenRun(SHA_A, "2026-08-17T10:00:00Z")], (runsPath, dir) => {
      const extraPath = path.join(dir, "trigger.json");
      writeFileSync(extraPath, "null", "utf8");
      const result = run([SELECTOR, "--runs", runsPath, "--extra-run", extraPath]);
      expect(result.status).toBe(0);
      expect(result.stdout.split(/\s+/)[0]).toBe(SHA_A);
    });
  });

  test("--extra-run 里的红 run 不会被当成绿混进来", () => {
    withRuns([greenRun(SHA_A, "2026-08-17T10:00:00Z")], (runsPath, dir) => {
      const extraPath = path.join(dir, "trigger.json");
      writeFileSync(
        extraPath,
        JSON.stringify({ ...greenRun(SHA_C, "2026-08-17T13:00:00Z"), conclusion: "failure" }),
        "utf8",
      );
      const result = run([SELECTOR, "--runs", runsPath, "--extra-run", extraPath]);
      expect(result.stdout.split(/\s+/)[0]).toBe(SHA_A);
    });
  });

  test("--format json 给出的就是过滤+排序后的同一份集合（审计器的 SLO 算式吃它）", () => {
    withRuns(
      [
        greenRun(SHA_A, "2026-08-17T10:00:00Z"),
        greenRun(SHA_C, "2026-08-17T12:00:00Z"),
        { ...greenRun(SHA_B, "2026-08-17T11:00:00Z"), conclusion: "cancelled" },
      ],
      (runsPath) => {
        const result = run([SELECTOR, "--runs", runsPath, "--format", "json"]);
        expect(result.status).toBe(0);
        const parsed = JSON.parse(result.stdout) as Array<{ head_sha: string }>;
        expect(parsed.map((item) => item.head_sha)).toEqual([SHA_C, SHA_A]);
      },
    );
  });
});

describe("同源性 —— 两侧必须调同一个文件，而不是各写一份判据", () => {
  const publisher = readFileSync(PUBLISHER, "utf8");
  const auditor = readFileSync(AUDITOR, "utf8");

  test("发布器与审计器都调 .crabcode-plugin/latest-green-main.py", () => {
    expect(publisher).toContain(".crabcode-plugin/latest-green-main.py");
    expect(auditor).toContain(".crabcode-plugin/latest-green-main.py");
  });

  test("审计器不再自己内联「哪些 run 算绿」的过滤式", () => {
    // 旧形态在两个 step 里各写了一遍 status/conclusion 过滤 + created_at 排序。
    expect(auditor).not.toContain('item.get("conclusion") == "success"');
  });

  test("发布器的目标 SHA 不来自 HEAD，且 checkout 用 ref: 钉死", () => {
    // 这就是立项 §6 PR-1 的负向对照 (c)：把发布器改回「发 HEAD」形态，本条必须红。
    expect(publisher).not.toContain('SHA="$(git -C marketplace-src rev-parse HEAD)"');
    expect(publisher).toContain("ref: ${{ needs.resolve.outputs.sha }}");
    expect(publisher).toContain("TARGET_SHA: ${{ needs.resolve.outputs.sha }}");
  });

  test("发布器不再被裸 push 触发，而是等 CI 的 workflow_run 绿", () => {
    expect(publisher).toContain("workflow_run:");
    expect(publisher).toContain('workflows: ["CI"]');
    expect(publisher).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(publisher).toContain("github.event.workflow_run.event == 'push'");
    expect(publisher).toContain("github.event.workflow_run.head_branch == 'main'");
    // 裸 `push:` 触发必须已经不在（它正是「发一个还没测完的 commit」的入口）。
    expect(/^on:\n(?:[ \t]+.*\n|\n)*?[ \t]{2}push:/m.test(publisher)).toBe(false);
  });

  test("发布前幂等早退与发布后验收调的是同一个 verify-mirror-bundle.py", () => {
    // 只数**真的调用**，不数注释里的提名（否则这条断言的分母随行文变动而漂）。
    const calls =
      publisher.match(/python3 rule-src\/\.crabcode-plugin\/verify-mirror-bundle\.py/g) ?? [];
    // 一次 pre-flight + 一次 post-publish；写成两份内联 python 就是本立项在治的病。
    expect(calls.length).toBe(2);
    expect(publisher).toContain("skip=true");
    expect(publisher).toContain("needs.resolve.outputs.skip != 'true'");
    expect(publisher).toContain("needs: resolve");
  });

  test("审计器失败提示指向一个真实存在的 workflow", () => {
    expect(auditor).toContain("publish-to-cn-mirror.yml -R acosmi/CrabCode-Plugin");
    // 已退役的那条不许再作为可执行指路出现在提示里。
    expect(auditor).not.toContain(
      "FAIL_HINT=\"Run: gh workflow run sync-plugins-to-mirror.yml",
    );
  });
});

describe("verify-mirror-bundle.py —— 幂等早退与发布后验收的同一个判据", () => {
  test("SHA 形态不合法时立刻拒绝，不去碰网络", () => {
    const result = run([VERIFIER, "--base", "https://updates.invalid/x", "--sha", "nope"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("目标 SHA 形态不合法");
  });

  test(
    "404 不重试 —— 「这个 SHA 还没发过」是确定性答案，不是瞬态",
    async () => {
      // 这是幂等预检最常走的一条路径（新 commit ⇒ zip 还不存在）。把 404 当瞬态退避
      // 重试会白等 2+4+6=12s，并且把「还没发」说成「不可达」。
      //
      // ⚠️ 这里**必须**用异步 spawn：spawnSync 会阻塞 Bun 的事件循环，同进程的
      // Bun.serve 就永远回不了那个 404，python 反而会走满 4×120s 的连接超时 ——
      // 第一版就是这么把测试挂了 8 分钟的（而且 spawnSync 同时冻住 bun:test 自己的
      // 超时机制，连"超时失败"都发不出来）。
      const server = Bun.serve({ port: 0, fetch: () => new Response("nope", { status: 404 }) });
      try {
        const started = Date.now();
        const proc = Bun.spawn(
          [PY, VERIFIER, "--base", `http://127.0.0.1:${server.port}/plugins/x`, "--sha", SHA_A],
          { stdout: "pipe", stderr: "pipe" },
        );
        const [status, stderr] = await Promise.all([
          proc.exited,
          new Response(proc.stderr).text(),
        ]);
        const elapsed = Date.now() - started;
        expect(status).toBe(1);
        expect(stderr).toContain("HTTP 404");
        // 退避重试要 12s；不重试是几十毫秒。5s 的门槛落在这两者之间很宽的空当里
        // ——不是「看起来宽」，两个真实取值差了两个数量级。
        expect(elapsed).toBeLessThan(5000);
      } finally {
        await server.stop(true);
      }
    },
    15_000,
  );
});
