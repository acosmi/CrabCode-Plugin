---
name: AI 政策监控
short-description: 监控中国 AI/算法/深度合成监管动态,逐条登记为 reg-policy 记录并提示影响
description: 监控中国 AI/算法/深度合成监管动态,逐条登记为 reg-policy 记录并提示影响。当用户提到 AI 新规/算法监管更新/生成式AI政策跟踪/网信办又出文件了/盯一下深度合成立法、需要跟踪 AI 监管变化时使用本技能(即使未明说"监控")。
argument-hint: "[关注的监管领域、机关或具体法规线索]"
---

# /cn-ai-governance:policy-monitor

【AI 辅助草稿，需律师复核】

Monitor PRC AI/algorithm/deep-synthesis regulatory developments and register each as a `reg-policy` record. 本技能产出内部监控台账,不构成合规结论,不得标注为可对外报送的最终版本。

## Matter Gate

Apply the standard CrabLaw-CN Matter Gate, Shared Guardrails, and Currency Gate from `matter-core/PRACTICE.md` (Required Gate: active matter, authorized scope, conflict-check status `no-hit` or `cleared-by-lawyer`, internal-only output destination, review queue item created, source records writable). Stop with the matching matter-core stop code if any check fails.

## Workflow

1. 划定监控范围:聚焦中国 AI 监管核心法规及其修订/配套,默认中国法:
   - 《生成式人工智能服务管理暂行办法》及配套(安全评估、上线登记、语料/标识标准)。
   - 《互联网信息服务算法推荐管理规定》。
   - 《互联网信息服务深度合成管理规定》及内容标识规则。
   - 《个人信息保护法》《数据安全法》的 AI 相关交叉规则与国家标准。
2. 逐条采集监管项,对应 `reg-policy` 字段:
   - `title` / `issuer`(发文机关,如国家网信办)/ `documentNumber`(文号)。
   - `effectiveLevel`(法律/行政法规/部门规章/规范性文件/国家标准等)。
   - `domain`(如 生成式AI / 算法推荐 / 深度合成)。
   - `publishedDate` / `effectiveDate` / `status`(征求意见稿/已公布未施行/施行中/已修订/已废止/被取代)。
3. 评估对本企业已登记 `ai-usecase` 的影响面(新增义务、备案触发、标识要求变化),记入 `notes`。
4. 为每条标 `citationTag`;`[已核验-来源]` 须填 `sourceRef`。Currency Gate:超过 90 天未核验的条目按 stale 处理并标 `[模型知识-待核]`。
5. Record verified sources in `sources.jsonl`. For any unverifiable point, mark it `[需核验]` AND write a paired `source-record` (`status: source-needs-check`; `effectiveStatus` describing the gap). The bundle check enforces that `[需核验]` and `source-needs-check` co-occur.
6. 写入/更新 `reg-policy` 记录(复用既有 schema,不新造);若产生评论/合规截止期,登记 `compliance-deadline`(`obligationType: regulatory-filing`)而非存入 reg-policy。
7. Create a review queue item。

## Output

Return:

- 监管动态台账(逐条 `reg-policy` 摘要:名称、机关、效力位阶、状态、生效日)。
- 影响评估(对哪些已登记用例产生新义务)。
- 征求意见/合规截止期清单(若有,已登记为 `compliance-deadline`)。
- 来源与时效(currency)状态表。
- Lawyer review points。

## Next Steps

- 影响某用例需重做评估:hand off to `/cn-ai-governance:aia-generation`。
- 需对照新规找企业差距:hand off to `/cn-ai-governance:reg-gap-analysis`。
- 需更新内部治理制度:hand off to `/cn-ai-governance:policy-starter`。
- 截止期登记后:由 `/matter-core:compliance-deadline-watcher` 跟踪。
