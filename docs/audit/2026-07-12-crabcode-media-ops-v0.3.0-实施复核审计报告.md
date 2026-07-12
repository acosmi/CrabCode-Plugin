# crabcode-media-ops 0.3.0 实施复核审计报告

日期：2026-07-12

审计范围：`plugins/crabcode-media-ops/`、marketplace 注册、能力路由、CI、发布元数据与镜像触发链路

对照方案：`2026-07-12-crabcode-media-ops-插件优化审计与实施方案.md`

结论：**发布前复核审计通过**

## 一、结论

方案中的 Gate A 范围已全量实施，P0 绕过路径已关闭，创作者风格采集表单作为强制能力完成。未发现阻断 0.3.0 发布的 P0/P1 缺陷。

真实平台 API、浏览器最终发布、自动评论、非官方爬虫、全网查重和平台原创声明保证继续留在 Gate B/排除范围，没有被伪装成已实现能力。

## 二、核心实施结果

### 1. 内容与发布门禁

- 内容采用不可变 revision、统一 content manifest、revisionId 和 SHA-256 contentHash；
- 事实核查不能再通过省略 claims 绕过：缺 review 返回 `REVIEW_REQUIRED`；
- 空主张台账必须说明“未发现可验证主张”的理由；
- 存疑放行绑定当前 revision 中的 claimId、具名人员和理由；
- 原创复核、法律风险路由、AI 披露、profile 版本、资源权利和平台规则时效进入统一 readiness；
- 审批状态机支持 pending/approved/rejected/revoked；
- 审批绑定 contentId、platform、revisionId 和 contentHash；
- 发布包只接受 contentId、approvalId、packagedBy，打包前重新执行完整 Media Gate；
- 审批后改稿返回 `APPROVAL_STALE`；资源实际复制进包，移动发布包不再依赖原绝对路径。

### 2. 创作者风格表单

- 独立 `media-style-intake` 与 `media-style-manager`；
- quick/full/incremental 三种模式；
- 本地自包含 HTML 可视表单，导出数据可直接保存；
- draft 保存与恢复、submitted、confirmed、superseded 状态；
- 增量模式要求现有 profile，并预填 baseProfileVersion；
- 表单与语料抽象观察对完整风格字段做冲突比对；
- 所有冲突必须逐项选择 form/corpus，选择结果实际进入新 profile；
- brandId 作用域隔离；profile 使用不可变版本、历史和回滚；
- 外部样本只保留元数据和抽象特征，不保存全文；
- 直接人工导入也必须具名确认并生成新版本，不覆盖历史。

### 3. 技能与平台能力

- 三板块九技能已注册：媒体底座 2、编辑创作 5、平台交付 2；
- `media-ops` 与 `wechat-original-opinion` 的正向/近邻排除边界已明确；
- 共享 Media Gate、编辑实践和平台交付实践已建立；
- 五份 JSON schema 已落库；
- 原创扫描脚本明确只比较用户提供文本、无原创率或平台结果保证；
- 中文热点采用字符 unigram/bigram/trigram 与重叠系数，具备同事件合并和泛词误并防护；
- 平台规则记录 sourceUrl、verifiedAt、scope、ruleType、maxAgeDays；
- AI 披露区分 platform-native、body-label、file-metadata，不再把固定正文句子写成唯一法定形式。

## 三、复核中发现并修复的问题

1. 首轮中文聚类阈值偏保守，同一事件的改写标题未合并；补充字符特征并增加正反回归测试后通过。
2. 首版风格冲突只比较六个字段；改为完整风格对象的递归扁平化比较。
3. 首版选择 corpus 值后只更新审计特征，没有回写 profile 对应字段；改为按字段路径写入 resolvedData，再生成 profile。
4. 首版可视表单导出 raw 数据，不能直接提交确定性接口；改为导出完整结构化 data，并为增量模式注入 baseProfileVersion。
5. marketplace 版本更新时曾误命中 `crablaw-cn` 的相同旧版本文本；已恢复法律插件版本，仅更新媒体插件，并由版本一致性校验锁定。

## 四、验证证据

- 媒体插件 TypeScript 类型检查：通过；
- 媒体插件单元/集成测试：**51/51 通过**；
- 媒体专用校验：九技能、五 schema、相对引用、工具引用与 0.3.0 版本一致性通过；
- 九个 SKILL.md 分别通过 skill-creator quick validation；
- MCP server 冷启动并在 stdin EOF 下正常退出；
- 原创扫描脚本实际运行通过，并返回 `scope=user-supplied-texts-only`、`guarantee=none`；
- 根仓库 TypeScript 类型检查：通过；
- 根仓库测试：**61/61 通过**；
- 根仓库 manifest、marketplace、layout、brand、reference 与 tool-scope 全量校验：通过；
- `git diff --check`：通过；
- 20 条触发/近邻排除测试集已归档；
- 8 条工作流评测定义已归档；
- 6 个关键场景的静态评测审阅页已由 skill-creator viewer 生成。

评测审阅页：`2026-07-12-crabcode-media-ops-评测审阅.html`

## 五、验收矩阵

| 方案验收项 | 结果 |
|---|---|
| 发布包可反查来源、稿件/profile 版本、审稿、审批人与哈希 | 通过 |
| 未审、未批、审批后改稿机器阻断 | 通过 |
| AI 披露按三种实际方式记录 | 通过 |
| 固定正文句不再被写成唯一法定形式 | 通过 |
| 总编排与公众号原创观点触发边界 | 通过 |
| quick/full/incremental 表单 | 通过 |
| 草稿、提交、确认、废止/取代状态 | 通过 |
| 表单与语料冲突逐项确认 | 通过 |
| 未确认不得由表单覆盖正式 profile | 通过 |
| 多品牌隔离、版本、diff、历史、回滚 | 通过 |
| 原创扫描不保证原创率/平台结果 | 通过 |
| 平台规则来源与核验时间 | 通过 |
| 中文热点真实样例聚类 | 通过 |
| plugin/package/server/capabilities/marketplace 版本一致 | 通过 |
| 根仓库、插件测试、技能校验、评测归档 | 通过 |
| README 与 Gate A/Gate B 实际能力一致 | 通过 |

## 六、发布边界与持续风险

- 平台后台规则会变化；规则过期后 readiness 会阻断，发布当天仍需人工复查。
- 工具能验证“存在具名决定”，不能在 Gate A 内完成企业身份认证；批准权的组织授权仍由使用方负责。
- 写作质量属于主观产物，运行时继续保留人工逐稿复核，不用机械分数替代。
- 当前仓库使用 `.crabcode-plugin` 规范，因此采用本仓 canonical validator；面向 `.codex-plugin` 的通用 scaffold validator 不适用于此仓清单格式。

上述边界均已在技能、README 或工具返回中明示，不构成 0.3.0 发布阻断。
