---
name: 媒体选题研究
short-description: "检索热点、核验来源并建立媒体主张台账"
brand-color: "#3B82C4"
icon-small: "./assets/icon.png"
icon-large: "./assets/icon.png"
description: 为媒体选题做热点检索、去重聚类、可信来源核验与主张台账。用户要求找选题、追热点、联网核验、判断旧闻复炒或为文章准备证据时使用；不负责成稿或发布。
---

# 选题研究

先读取 `../../PRACTICE.md`，再按需读取 `../../../editorial/references/research-standard.md`。编排前先按其《运行前预检》确认 `mediaops.capabilities` 可用与身份就绪；预检失败按停止码停止，研究结论一律记 `GATE_NOT_EXECUTED`，不得以手工检索冒充服务端 capture。

1. 明确主题、读者、时效窗口和目标平台。
2. 联网研究是成稿前置条件，不是可选建议。热点工具只用于发现线索；必须实际 WebSearch 找到候选 URL，并逐页调用 `mediaops.research.capture` 由服务端真实打开、限制并哈希快照。调用方自报 HTTP 状态或页面文本不算证据。
3. 优先原始文件、监管或机构官网、公司公告和原始研究；为每个 capture 提交与快照绑定的 `assessment.publisherType/sourceFunction/originRelationship/basisExcerpt/classificationRationale`。来源层级、primary 状态和独立组由服务端派生，禁止自报 `sourceTier`、`isPrimary`、`originPublisher` 或 `independenceGroup`。
4. 为每个候选选题输出：新信息、公共价值、作者可形成的独立判断、强反方、证据缺口和旧闻风险。
5. 建立主张台账，区分事实、来源解释和作者推论；核心主张至少两组独立来源，其中至少一项为原始/权威来源。主动记录反证、冲突和缺口。
6. 用户提供的参考文只能作为检索 seed 和原创比较对象，不能计作独立支持来源。`mediaops.research.complete` 只接受服务端 capture、快照绑定的来源评估和主张级证据；零结果、缺 capture、页面未打开、评估依据/证据摘录不在快照、同组织/发布者/近似转载或证据不足必须保持 `action_required`。

输出不含第三方原文的结构化研究 brief，不直接输出成稿。研究完成操作要求具备 `fact_checker` 角色的可信 principal，并与 intake 作者分离；参数中的 `completedBy` 不是身份。下一步在 fresh context 中交给创作技能并保存 `researched` manifest。
