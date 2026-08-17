#!/usr/bin/env python3
"""「哪个 commit 可以被发布 / 被审计」的**唯一**判据 —— W-PUBLISH-PROVENANCE-GATE PR-1。

立项真源：acosmi/crabcode-source `docs/audit/2026-08-17-发布来源门缺失-立项审计与实施路径.md`

## 它解决的病

那份立项的一句话是：**这个系统有一套发育完整的「产物来源」纪律，和一个完全不存在的
「源码质量来源」纪律**；而唯一存在的那个源码质量门长在**消费侧**（审计器
`notify-mirror.yml` 只接受绿 SHA），生产侧（发布器）一个字都没有 —— 它发的是
`${GITHUB_SHA}`，此刻是什么就发什么。两边各自演化的判据正是这条链坏过三次的形状。

修法不是「给发布器加一道会挡人的门」（本仓 main 若哪天红了，fail-closed 就是永远发不
出去），而是 **把「加一道门」翻转成「两边用同一条规则算同一个答案」**：发布器与审计器
都调用**本文件**来回答「最新的绿 SHA 是哪个」。门会挡人，同源不会。

## 判据（逐条都是可复算的）

一次 run 算「绿」当且仅当四条同时成立：
  * `status == "completed"`
  * `conclusion == "success"`
  * `event == "push"`      —— PR 上的绿证明不了 main 上的绿
  * `head_branch == "main"`
缺字段即**不算绿**（fail-closed）。发布器宁可不发也不发错：不发会被审计器的
freshness SLO 在 8 小时内喊出来，发错则落进 `immutable` 一年缓存里收不回来。

排序取 `created_at` 倒序 —— 这一条**逐字沿用审计器 2026-08-17 之前的既有行为**，
本次改动是「同源化」不是「改语义」。已知局限：重跑一个旧 commit 的 CI 会把它排到前面
（run 创建时刻不是 commit 顺序）。要根治得引入 git 祖先关系，那是另一件事；在这里
写死一个**两边共用**的近似，比两边各写一个**不同**的近似严格更好。

## 调用形态

    latest-green-main.py --runs runs.json                  # -> "<sha> <html_url>"
    latest-green-main.py --runs runs.json --format json    # -> 过滤+排序后的完整数组
    latest-green-main.py --runs runs.json --extra-run r.json

`--runs` 吃的就是 GitHub REST
`/actions/workflows/ci.yml/runs?branch=main&event=push&per_page=100` 的原样响应。

`--extra-run` 吃一个**单个 run 对象**（发布器由 `workflow_run` 事件触发时，把
`github.event.workflow_run` 原样丢进来）。为什么需要它：触发发布的正是那次 run，而
REST 列表未必立刻能看见它 —— 少了这一手，最坏情况是「新绿 commit 永远轮不到发布」这种
**静默漏发**。内容为 `null` / 空 / 不满足上面四条判据时静默忽略（手动 dispatch 那条腿
本来就没有事件）。合并后按 (head_sha, created_at) 去重。

出口码：0 = 选出来了；1 = 没有任何一次绿 run（调用方必须当作硬失败，不许兜底发 HEAD）。
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from typing import Any

SHA_RE = re.compile(r"^[0-9a-f]{40}$")
REQUIRED_EVENT = "push"
REQUIRED_BRANCH = "main"


def is_green(run: Any) -> bool:
    """四条判据全成立才算绿；任一字段缺失即 False（fail-closed）。"""
    if not isinstance(run, dict):
        return False
    return (
        run.get("status") == "completed"
        and run.get("conclusion") == "success"
        and run.get("event") == REQUIRED_EVENT
        and run.get("head_branch") == REQUIRED_BRANCH
        and isinstance(run.get("head_sha"), str)
        and SHA_RE.fullmatch(run["head_sha"]) is not None
    )


def green_runs(payload: Any, extra: Any = None) -> list[dict]:
    """过滤 + 合并 --extra-run + 按 created_at 倒序 + 去重。"""
    runs = []
    if isinstance(payload, dict):
        listed = payload.get("workflow_runs")
        if isinstance(listed, list):
            runs.extend(listed)
    elif isinstance(payload, list):
        runs.extend(payload)
    if extra is not None:
        runs.append(extra)

    selected = [run for run in runs if is_green(run)]
    selected.sort(key=lambda run: str(run.get("created_at", "")), reverse=True)

    deduped: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for run in selected:
        key = (run["head_sha"], str(run.get("created_at", "")))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(run)
    return deduped


def load_json(path: str) -> Any:
    with open(path, encoding="utf-8") as handle:
        text = handle.read().strip()
    if text == "" or text == "null":
        return None
    return json.loads(text)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runs", required=True, help="GitHub REST workflow-runs 响应的 JSON 文件")
    parser.add_argument("--extra-run", default=None, help="额外的单个 run 对象（workflow_run 事件载荷）")
    parser.add_argument("--format", choices=["sha", "json"], default="sha")
    args = parser.parse_args(argv)

    payload = load_json(args.runs)
    extra = load_json(args.extra_run) if args.extra_run else None
    # `github.event.workflow_run` 直接给的就是 run 对象；但如果调用方丢来的是整个事件
    # 载荷，也接住它的 workflow_run 字段 —— 两种形态都不该让发布链静默漏发。
    if isinstance(extra, dict) and "workflow_run" in extra and "head_sha" not in extra:
        extra = extra.get("workflow_run")

    runs = green_runs(payload, extra)
    if not runs:
        print(
            "no successful main push CI run with a valid SHA",
            file=sys.stderr,
        )
        return 1

    if args.format == "json":
        print(json.dumps(runs, ensure_ascii=False))
        return 0

    newest = runs[0]
    print(f"{newest['head_sha']} {newest.get('html_url', '')}".rstrip())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
