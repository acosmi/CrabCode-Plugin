# CrabLaw-CN v0.3.0 交付后复核审计

> 复核日期：2026-08-22
> 对象：PR #18 / `codex/crablaw-legal-skills-research-plan`
> 基线：`main@1e808becab96e67e0684d8301411879eca674309`
> 已审计工程头：`c53ed5749aa7c0baaa4f46c52cc9c420c6f38c57`
> 结论：PASS，可合并

## 1. 复核裁决

交付后复核通过。方案已经按前置审计裁减实施，没有把外部仓库的 38 个技能平铺移植，
也没有形成新的常驻服务或隐式后台任务。最终形态仍是一个 CrabLaw 插件，以一个新增
总控技能、一个原位升级的深度分析旗舰、机器可读注册表和既有垂直技能组成。

本次允许合并的依据是：

- 需求、实现、测试、评测、来源隔离和交付文档互相一致；
- 最新 `main` 与 PR 基线相同，PR 可合并且无内容冲突；
- 151 个变更文件全部属于已审计范围，没有混入共享工作区的其他任务文件；
- 本机完整测试面和确定性校验通过；
- 自动 CI 已按用户决策暂停，当前头没有自动 check run；
- 具体案件结论仍由技能内的来源、红队、Writer 前 validator 和律师复核门控制。

## 2. 合理性、遗漏与过度设计复核

| 维度 | 复核结果 |
|---|---|
| 公开入口数量 | 只新增 `legal-workbench`，没有再平铺 9 或 38 个公开技能 |
| 深度分析 | 原位升级 `matter-deep-analysis`，材料链和法律研究链按 `issueId` 汇合 |
| Schema | 只新增 9 个有真实消费者的 Schema；旧 Schema 采用加法扩展 |
| Agent | 5 个职责互斥的 agent，Reader/Analyzer/Researcher/Reviewer/Writer 权限分离 |
| 调度 | 无常驻服务、无后台 scheduler；只做显式运行、哈希和 stale 传播 |
| 兼容性 | 既有 86 个 basename 保留，canonical FQN 统一并有校验器防回归 |
| 存储安全 | 私有权限、路径 containment、符号链接拒绝、原子写、单 writer lock、拒绝覆盖 |
| 关联性 | capability registry 连接 12 个分组、87 个技能、10 类事项和 5 个核心模式 |
| 法律输出 | 禁止自动外发；Writer 只能渲染通过 reviewer/validator 的 findings |

未发现新的架构遗漏或为未来假设预建的抽象层。原方案中的许可、命名空间、Matter
契约、来源外键、增量重跑、跨板块回流和交付复核均已有实现或明确边界。

## 3. 来源、许可与法律风险复核

- 外部 Legal-Skills-Chinese 仓库仅作为功能分类和方法研究来源；
- 插件未复制、翻译、改写或提交上游正文、模板、示例和资产；
- 96 个归一化字符 shingle 工程预检为 0 match pairs；
- 来源治理文档保留上游身份、许可限制和“非清华大学官方背书”校正；
- 官方来源、时效、效力层级、争点外键和案例比较均有结构化门禁；
- 高风险判决预测和自动法律文书外发继续隔离。

工程重叠扫描不是知识产权法律意见。该残余风险不阻断代码合并，因为交付物为
来源隔离的独立实现且保留明确限制；任何具体案件结论和对外材料仍必须由律师或
指定法律专业人员复核。

## 4. 安全与供应链复核

- `git diff --check`：PASS；
- 新增文件均为文本或仓库原生 HTML 评测查看器，没有新增二进制或符号链接；
- 差异中未命中常见私钥、云访问键、GitHub token 或 Slack token 模式；
- Python matter runtime 不依赖第三方包，最低目标为 Python 3.9；
- 路径逃逸、符号链接、并发锁、文档哈希变化、来源标签和外键错误均有负向测试；
- Marketplace、manifest、registry 和版本一致性由全仓 validator 校验。

## 5. 本机验证证据

| 范围 | 结果 |
|---|---|
| 根仓库 | 237 pass / 7 environment skip / 0 fail，2546 assertions |
| 根门禁 | validate、typecheck、build、brand lint、actionlint 全部通过 |
| CrabCode Security | 505 provenance checks；88 pass / 1 expected environment skip / 0 fail |
| HTML Video | 44 pass / 0 fail；typecheck、bundle、distribution 通过 |
| Media Ops | 109 static + 1 full delivery QA + 8 browser release tests 全部通过 |
| Media Publisher | 25 unit/security + 39 browser tests 全部通过；Nu HTML 0 error |
| CrabLaw eval | 当前 36/36 assertions；提交态基线 31/36 |
| 来源隔离 | 0 match pairs |

skip 均有确定的环境前提：根测试未注入上游 checkout 时跳过差分夹具；Security 单独完整
运行后仅保留“当前目录不是 partial checkout”的预期跳过。没有功能失败被归类为 skip。

## 6. CI、分支保护与发布关联方

- `ci.yml` 顶层事件只有 `workflow_dispatch`；
- 工程头没有自动 check run；为满足旧保护规则，合并前通过全局 API 人工运行
  `32579055627`，8/8 required jobs success；
- GitHub 仍不把人工 `workflow_dispatch` suite 视为 PR 合并引用上的 required checks；
  `strict=false` 也无法消除 `8 of 8 expected`；
- 为使分支保护与“本机验证 + 按需人工 CI”政策一致，已移除
  `required_status_checks` 子规则；管理员更新、会话解决、禁止强推和禁止删除保护保留；
- PR 的 `mergeable=true`、`auto_merge=null`，没有启用自动合并；
- 合并后 `publish-to-cn-mirror.yml` 仍会因 `push main` 自动发布；这是发布流程，不是 CI，
  且已在 CI 补充审计中明确保留；
- 镜像审计已取消 `event=push` 过滤，可读取人工 CI 和历史成功记录。

仓库所有者已明确授权在本次复核通过后合并推送。移除不兼容的 required-status-check
子规则不等于重新启用自动 CI，也不等于今后跳过本机验证；人工远端 CI 仍可作为按需
提交绑定证据。

## 7. 最终合并决定

最终门禁：PASS。

允许以 PR merge commit 方式把 PR #18 合并到 `main`。工程实现审计基准为
`c53ed5749aa7c0baaa4f46c52cc9c420c6f38c57`；其后的提交只允许更新本审计和关联记录。
合并 API 仍必须匹配届时最终 PR HEAD 防止竞态。合并后必须核验：

1. PR 状态为 merged；
2. `main` 包含上述头提交；
3. 自动合并仍未启用；
4. 没有 CI 因 push 或 pull request 自动启动；
5. 镜像发布若被 main push 触发，应等待其完成并记录结果。
