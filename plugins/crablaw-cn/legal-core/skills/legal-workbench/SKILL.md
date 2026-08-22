---
name: 法律工作总控
short-description: 统一识别中国法律任务、建立事项前提并编排跨板块工作流
description: 统一接收中国法律实务任务,先处理客户/事项/利冲/权限/来源/复核前提,再按能力注册表编排合同、诉讼、公司、知产、劳动、数据、AI、监管、产品或法援流程。当用户说帮我处理法律事项/看这些材料怎么办/不知道该用哪个法律能力/任务跨多个法律领域,或需要端到端法律工作流时使用;法考学习不使用本技能。
argument-hint: "[法律任务、材料路径或 matter id]"
---

# crablaw-cn:legal-workbench

【AI 辅助草稿，需律师复核】

Act as the single control plane for CrabLaw-CN. Route and coordinate; do not absorb specialist work
or present a final legal opinion.

## Load the control contracts

Before planning, read:

1. `${CRABCODE_PLUGIN_ROOT}/legal-core/capability-registry.json`;
2. `${CRABCODE_PLUGIN_ROOT}/matter-core/PRACTICE.md`;
3. `${CRABCODE_PLUGIN_ROOT}/legal-core/PRACTICE.md`.

The registry is the source of domain/default capability names. Do not invent a board namespace or a
callable absent from the registry.

## Matter Gate

This control skill may establish prerequisites, so the absence of an active matter is not itself an
error at intake. It must not enter substantive analysis until all applicable Required Gate checks in
`matter-core/PRACTICE.md` pass.

1. Identify the user role and intended destination.
2. If the request is only law-school/exam study, route outside this plugin to `cn-legal-study` and
   stop the matter workflow.
3. If client/matter records are missing, collect only the minimum facts and route in order to
   `crablaw-cn:new-client`, then `crablaw-cn:new-matter`, then `crablaw-cn:conflict-check`.
4. A pending, hit-review-required, or declined conflict status blocks substantive work.
5. Confirm engagement scope, allowed user/team, confidentiality, and whether source/audit/review
   records can be written.

## Classify the task

Choose one primary path and any required specialist branches:

- intake/matter operations;
- bounded legal research;
- multi-document or multi-issue deep analysis;
- one domain task;
- cross-domain transaction/dispute/compliance task;
- review, delivery, or archive operation.

Use `crablaw-cn:matter-deep-analysis` when the request requires multiple documents, an issue tree,
source/case research, claim-evidence mapping, or two or more specialist domains. A simple bounded leaf
task may route directly to its registry capability after the gate passes.

## Build the workflow plan

Return a concise plan before substantive work:

1. matter and scope;
2. primary capability;
3. ordered core modes and specialist capabilities;
4. required inputs and missing facts;
5. expected structured artifacts;
6. review owner and output destination;
7. stop conditions.

Use canonical names such as `crablaw-cn:review`; never combine a directory/group name such as
`cn-contract` with a skill basename as though the group were a plugin.

## Coordinate without duplicating state

- Pass matter/run/issue/artifact IDs between capabilities.
- Reuse existing source and review records; do not create a parallel store.
- A specialist branch returns a structured finding or a documented limitation to the parent issue.
- Preserve upstream severity and citation tags.
- If new material changes an analyzed input, mark affected issues stale and explicitly rerun them;
  do not silently reuse the old conclusion.

## Output ceiling

The workbench may provide routing, status, missing-input, and review summaries. Specialist legal
analysis remains with the selected capability and is always an internal draft for lawyer review.
Never send, file, sign, approve, or publish a result automatically.
