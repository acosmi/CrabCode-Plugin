---
name: compliance-deadline-watcher
argument-hint: "[matter id | --sweep] [optional: stop]"
description: 启动并自动续期一个会话内自调度的看护任务,持续盯防结构化的合规与合同期限,将临期或逾期项推入复核队列供律师处理;只测算与提醒,绝不对外发送或提交。当用户提到盯期限/到期提醒/期限看护/别漏了截止日/合规期限/续约到期/逾期监控,或需要持续监看各类截止日时使用本技能(即使未明说"看护")。
---

# /matter-core:compliance-deadline-watcher

【AI 辅助草稿，需律师复核】

A self-scheduling watch over compliance and contractual deadlines. You run it once to bootstrap;
it then re-arms itself on a recurring schedule and, each time it fires, computes which deadlines
are due or overdue and drops them into the review queue for a lawyer to act on. It computes and
surfaces only — it never sends, files, signs, or submits anything to a client, court, or regulator.

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate). In `--sweep` mode, apply the Gate per matter touched before surfacing any of its deadlines; skip matters whose gate fails and report them. Stop with the matching matter-core stop code if a required check cannot be satisfied.

## How scheduling works here

The runtime, not a plugin, owns scheduling. There is no manifest cron type and no background daemon
a plugin can register. The scheduling tools are `CronCreate` / `CronList` / `CronDelete`, and a
recurring schedule **auto-expires after 7 days**. So the watch only survives if each firing re-arms
the next one. That re-arm is part of this skill's job, and it is bounded — the user can stop it any
time (see Stopping).

## Run steps

1. **Anchor today.** Take the current date from the session context. All date math is `dueDate − today` in whole days.
2. **Load structured records.** Read the active `compliance-deadline` records (`status: active`) for the target matter, or for every active matter in `--sweep` mode, validated against `matter-core/schemas/compliance-deadline.schema.json`. Never infer deadlines by re-parsing prose — if a matter has obligations but no structured record, report the gap and recommend creating one; do not invent a date.
3. **Classify each active deadline.**
   - `daysUntilDue < 0` → **RED (overdue)**.
   - `0 ≤ daysUntilDue ≤ leadTimeDays` → **YELLOW (in lead window)**.
   - `daysUntilDue > leadTimeDays` → **GREEN (upcoming)**, summarized but not queued.
   - Apply the Currency Gate to each record's `basis`; if the basis is stale, downgrade confidence and tag the surfaced item `[模型知识-待核]`.
4. **Surface, do not act.** For every RED and YELLOW item, create one `pending-review` queue item (`sourcePlugin: matter-core`, `sourceSkill: compliance-deadline-watcher`, `status: pending-review`) carrying the deadline title, dueDate, daysUntilDue, severity, basis, and citation tag. Write a watch report (RED → YELLOW → GREEN summary) to the matter `outputs/`. Append an `audit-log.jsonl` entry for the run. Optionally raise a local notification to the user — to the user only.
5. **Re-arm.** `CronList` first and skip if a `compliance-deadline-watcher` schedule already exists (no duplicates). Otherwise `CronCreate` a durable, recurring weekday-morning check (use an off-:00/:30 minute) whose prompt re-invokes this skill in the same mode. Tell the user the schedule was armed and that recurring schedules auto-expire after 7 days, so each firing refreshes it.
6. **Recurrence of the obligation itself.** When a deadline with `recurrenceMonths` is marked done by a lawyer, propose the next `dueDate` (= done date + recurrenceMonths) as a new record for confirmation; do not auto-create it.

## Stopping

`compliance-deadline-watcher stop` (or the user calling `CronDelete` on the listed job) removes the
schedule. Always report the active schedule's job ID so the user can stop it. The watch is opt-in
and bounded; it must never become a silent, permanent background process.

## Hard boundaries

These are red lines for the unattended (cron-fired) path, where the risk of silent auto-action is highest:

- **No outward action, ever.** The watch may compute, surface to the review queue, write an internal report, and notify the user. It must never send, file, submit, sign, or stamp anything to any client, court, regulator, or third party — not even a reminder email outward. Outbound action stays a separate, explicit, human-performed step after lawyer review.
- **Structured records only.** Deadlines come from `compliance-deadline` records, never from re-parsing matter prose at fire time (that would drift and hallucinate dates).
- **Bounded and visible.** The schedule is durable but re-armed per run, always surfaced with its job ID, and stoppable. No hidden perpetual job.
- **Lawyer owns the decision.** Every surfaced item is an internal `pending-review` draft under the 【AI 辅助草稿，需律师复核】 header. Computing that something is due is not advice that it has been handled.

## Output

A deadline watch report (RED overdue → YELLOW in-window → GREEN upcoming, each with citation tags),
one `pending-review` queue item per RED/YELLOW deadline, an `audit-log.jsonl` entry, and a re-armed
(or confirmed-existing) durable schedule reported with its job ID. All internal drafts for lawyer review.
