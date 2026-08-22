# CrabLaw-CN v0.3.0 下游字段与兼容契约

> 生效范围：`crablaw-cn` 0.3.0
> 变更类型：向后兼容加法；既有 86 个 skill basename 全部保留

## 1. 调用兼容

- 真实插件命名空间统一为 `crablaw-cn`；
- 既有下游调用如 `crablaw-cn:review`、`crablaw-cn:data-activity-triage`、
  `crablaw-cn:marketing-claims-review` 保持不变；
- `matter-core`、`cn-contract` 等是展示分组，不是插件命名空间；
- 新增公开技能仅 `crablaw-cn:legal-workbench`；
- `crablaw-cn:matter-deep-analysis` 原 basename 保持不变并原位升级。

## 2. Review Queue 加法字段

保留：

- `sourcePlugin`：历史上保存板块名；
- `sourceSkill`：保存技能 basename。

新增可选：

- `sourceCapability`：canonical FQN，如 `crablaw-cn:matter-deep-analysis`；
- `runId`：深度分析运行 ID；
- `issueIds`：本复核项覆盖的争点 ID。

新写入器应同时填历史字段和 canonical 字段。旧消费者可以继续只读取历史字段。
`decisionActor` 新增 `crablaw-cn:review-queue`，旧值 `matter-core:review-queue` 继续可读。

## 3. Source Record 加法字段

新增可选：

- `documentId`
- `contentHash`（SHA-256）
- `confidentiality`
- `accessScope`

既有来源记录无需迁移即可读取；新深度分析 run 的 document index 应与这些字段交叉校验。

## 4. Matter Store 新目录

既有 Matter 根结构不变，新增：

```text
matters/<matter-id>/runs/<run-id>/
```

运行目录保存 analysis plan、document index、fact chronology、issue tree、claim-evidence map、
case comparison、findings、specialist ledger、run manifest 和 review item。最终 memo 仍写入 Matter
根 `outputs/`。

## 5. 兼容策略

- 不把 `matterType`、`responsibleLawyer`、`reviewOwner` 直接升级为旧 Schema 的必填字段；
- 新 substantive run 的 validator 会要求它们，不满足时返回补正清单；
- 不自动猜测或迁移历史值；
- 不修改用户既有 Matter Store；
- 输入变化只标记受影响争点/产物 `stale`，不自动启动后台重跑。

## 6. 交付状态语义

- `engineering validated`：结构、外键、哈希和流程门禁通过；
- `pending-lawyer-review`：等待法律专业复核；
- `lawyer-reviewed`：人工复核完成；
- `externalRelease: approved`：还需独立、明确的外发批准和目的地记录。

工程验证不得被解释为法律准确性认证或外发批准。
