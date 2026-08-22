# CrabCopyright-CN × CodeSucker 审计结论与实施方案

> 日期：2026-08-21
> 本地审计基线：`12963f7`
> 本地对象：`plugins/crabcopyright-cn/`
> 对照对象：`fanbuz/codesucker`
> 文档性质：前置审计、实施方案与本机验收记录
> 实施状态：前置审计与交付后复核审计均通过；`v0.3.0` 已实施并完成最新 `main` 基线本机验收；远程自动 CI/发布/镜像审计均已暂停，仅保留 API/人工触发
> 合规声明：本文不构成法律意见；申请人必须按实际开发与材料制作情况如实申报

> 前置审计结论（2026-08-21）：**附修订通过**。总体方向合理；实施时采用本文第 13 节的收敛裁决。

## 0. 执行结论

`crabcopyright-cn` 有明确优化空间，但不应被 CodeSucker 整体替换。

两者最合理的关系是：

- `crabcopyright-cn` 保留为软件著作权登记的**全流程编排与合规控制面**；
- CodeSucker 的纯核心能力用于补强**源程序鉴别材料的确定性生产线**；
- Codex Documents/PDF 能力继续负责 Word/PDF 转换、渲染和视觉验收；
- 最终是否可提交，仍由 manifest、确定性脚本、人工真实性确认和新版申请表口径共同决定。

一句话裁决：

> **保留申请管家，吸收源码引擎；先修权威源和合规闸门，再做功能移植。**

当前最优先事项不是增加更多技能，而是修复四类基础问题：

1. 仓库源码、已安装 Codex 副本与版本号之间存在漂移；
2. 仓库版官方条文编号和部分校验行为落后于已安装副本；
3. 仓库版 `check_all.py` 存在材料缺失仍可能总体 `PASS` 的假通过路径；
4. 2026 新版申请表的“未使用 AI”承诺与本插件生成申请材料之间存在直接合规冲突，需要前置闸门。

---

## 1. 审计范围与证据边界

### 1.1 本地仓库审计范围

只读审阅了：

- `plugins/crabcopyright-cn/.crabcode-plugin/plugin.json`；
- 8 个公开技能；
- 3 个只读子代理；
- `apply-core/GUIDE.md` 与 `apply-core/MANIFEST.md`；
- 仓库版 5 个 Python 校验脚本；
- 根 Marketplace 条目、根校验器和 GitHub Actions；
- 2026-07-01 插件完善度历史审计与相关提交记录。

本轮还对照了本机已安装 Codex 副本：

- 路径：`/Users/fushihua/plugins/crabcopyright-cn/`；
- 版本：`0.2.0+codex.20260705170837`；
- 该副本包含 8 个校验脚本，并已修正部分条文编号、PDF 验收和日期默认值问题。

### 1.2 CodeSucker 对照范围

通过 GitHub 仓库页、Raw 文件和 Release/版本文档审阅了：

- 项目定位与五步使用流程；
- `packages/core/src/discover.ts`；
- `packages/core/src/clean.ts`；
- `packages/core/src/select.ts`；
- `packages/core/src/render.ts`；
- `packages/core/src/audit.ts`；
- `packages/core/src/types.ts`；
- 根包与 core 包测试/验证脚本；
- `VERSIONING.md`、`LICENSE`、`NOTICE`。

外部主要来源：

- 仓库：<https://github.com/fanbuz/codesucker>
- 源码选择：<https://github.com/fanbuz/codesucker/blob/main/packages/core/src/select.ts>
- DOCX 渲染：<https://github.com/fanbuz/codesucker/blob/main/packages/core/src/render.ts>
- 风险审计：<https://github.com/fanbuz/codesucker/blob/main/packages/core/src/audit.ts>
- 版本治理：<https://github.com/fanbuz/codesucker/blob/main/VERSIONING.md>
- 许可：<https://github.com/fanbuz/codesucker/blob/main/LICENSE>
- NOTICE：<https://github.com/fanbuz/codesucker/blob/main/NOTICE>

初次浅克隆曾因 TLS 连接失败；实施阶段随后通过 GitHub 对象接口取得并交叉核对正式发布
`v0.4.5` 的 annotated tag、commit、tree 与 11 个 core 源文件 blob。当前锁定 commit 为
`2e39375cf6891b9d958c277f1c6eb3b5104814d9`，vendor 文件同时记录 Git blob SHA-1、SHA-256、
字节数和一对一映射；本机 `verify-codesucker-port.ts` 已验证 11 个文件共 148,651 字节。
运行时不依赖 GitHub、浮动分支或完整上游工作树。

### 1.3 官方与平台口径

主要依据：

- 《计算机软件著作权登记办法》：<https://www.ncac.gov.cn/xxfb/flfg/bmgz/202410/t20241015_869486.html>
- 中国版权保护中心登记平台：<https://register.ccopyright.com.cn/registration.html>
- 湖北省版权保护与服务网对 2026 新版申请表的转述：<https://www.ccct.net.cn/html/bqzx/2026/0318/6637.html>
- 2017 年停征软件著作权登记费说明：<https://app.www.gov.cn/govdata/gov/201703/27/401727/article.html>

硬性基础口径为：

- 第九条：申请表、鉴别材料、证明文件；
- 第十条：程序和文档前后各连续 30 页，不足 60 页提交全部；程序每页不少于 50 行，文档每页不少于 30 行；
- 第十一条：身份证明及特定权属证明文件；
- 第二十条：受理后 60 日内审查完成。

2026 新版申请表要求属于平台现行填报口径，不冒充《登记办法》条文；上线前仍须以用户实际填报页面和最新版表格复核。

---

## 2. 两个项目的定位关系

### 2.1 `crabcopyright-cn` 的优势

本插件已经具备 CodeSucker 不覆盖的完整申请流程：

1. monorepo/大项目申请板块拆分；
2. 申请人类型、开发方式和特殊证明材料清单；
3. 源程序鉴别材料；
4. 用户手册/设计说明书鉴别材料；
5. 名称、版本号、日期和申请人一致性校验；
6. 多申请重叠检查；
7. 申请包归档与自查表；
8. 在线填报字段指导；
9. manifest 工序交接；
10. 收集者、生成者、审查者之间的信任隔离。

因此，现有伞插件结构不应推倒重来。

### 2.2 CodeSucker 的优势

CodeSucker 把源程序材料从“模型按说明操作”提升为“可执行、可重复、可测试”的本地流水线：

```text
discover → clean → select → render → audit
```

其值得吸收的能力包括：

- 读取 `.gitignore` 并叠加自定义排除规则；
- 文件扩展名、大小、二进制和编码探测；
- 入口文件优先、目录深度排序和人工排序；
- 逐字符状态机识别注释和字符串边界；
- 删除空行、Tab 转空格、长行折行；
- API key、密码、内网 IP、手机号等敏感信息替换；
- 超过 3000 行时精确取前 1500 行和后 1500 行；
- 每 50 行显式分页，不依赖 Word 自动分页碰运气；
- DOCX 页眉、PAGE 页码域、A4 尺寸和固定行距；
- `@author`、Copyright 与著作权人冲突检查；
- 文件修改时间早于主体成立日期的风险提示；
- core 包测试、真实项目测试和发布前 `verify` 门禁。

### 2.3 不能直接照搬的部分

以下 CodeSucker 行为应作为参考，不应未经评估直接硬编码进本插件：

1. **Electron UI**：本插件不需要嵌入整个桌面应用，只需要纯 core/CLI 能力。
2. **删除所有注释**：许可证、署名和权属证据必须在清洗前保留到审计记录；是否从提交稿移除应可配置。
3. **78 列硬折行**：折行会改变物理行数，必须保存原文件/原行号映射，不能被用作注水。
4. **首页/末页边界“自动通过”**：从首文件首行和末文件末行截取，只能证明文件边界，不能证明语义上一定是模块自然开头/结尾，仍需人工复核。
5. **末页 2/3**：属于经验风险提示，不应标成官方硬性规定。
6. **DOCX 即完成**：本插件最终上传场景仍须转换成 PDF 并直接验收 PDF。

---

## 3. 量化与结构对照

| 指标 | 仓库版 `crabcopyright-cn` | 本机已安装 Codex 副本 | CodeSucker |
|---|---:|---:|---:|
| 公开技能 | 8 | 8 | 非技能项目 |
| 只读审查/收集代理 | 3 | 3 | 0 |
| 校验脚本 | 5 | 8 | core TS 模块 + app |
| 材料存在性检查 | 无 | 有 | 不负责完整申请包 |
| 最终 PDF 基础检查 | 无 | 有 | 输出 DOCX/TXT |
| 说明书结构检查 | 无 | 有 | 路线图能力，当前非核心 |
| 状态机注释清洗 | 无 | 无 | 有 |
| 编码探测 | 无，UTF-8 replace | 无，UTF-8 replace | 有 |
| `.gitignore` | 无 | 无 | 有 |
| 敏感信息自动脱敏 | 无 | 无 | 有 |
| 精确前后 1500 行 | 仅提示词要求 | 仅提示词要求 | 有 |
| 显式 50 行分页 | 无 | 无 | 有 |
| DOCX 生成 | 交给办公套件 | 交给 Codex Documents/PDF | 有 |
| 署名冲突检查 | 无 | 无 | 有 |
| 专项单元测试 | 0 | 0 | 有 |
| 技能触发 eval | 0 | 0 | 不适用 |
| 合规规则独立版本 | 无 | 无 | 有 `RULES_VERSION` |

---

## 4. 审计发现

### P0-1：仓库与已安装副本发生反向漂移

**证据**：

- 仓库清单版本为 `0.2.1`，只有 5 个脚本；
- 已安装副本版本为 `0.2.0+codex.20260705170837`，却包含 8 个脚本；
- 已安装副本新增 `check_materials.py`、`check_pdf.py`、`check_manual.py`；
- 已安装副本的 `check_all.py` 已把源码缺失、功能说明缺失和最终 PDF 缺失改为 fail；
- 已安装副本修复了申请日期为空时偷偷使用当天日期的问题；
- 已安装副本同时包含宿主专用绝对路径和 `.codex-plugin` 结构，不能整目录反向覆盖仓库。

**影响**：

- 仓库中较高的版本号不代表功能更完整；
- 本地运行结果依赖安装副本而非可审计的仓库源码；
- 无法从仓库重现用户当前实际使用的插件；
- 后续修复可能只进入一份副本，继续产生漂移。

**裁决**：

- 仓库必须成为唯一权威源；
- 只选择性回迁通用逻辑，不回迁绝对路径和宿主特定 manifest；
- 若同时发布 CrabCode 与 Codex 形态，必须从同一源树生成，并做逐文件/功能差异门禁。

### P0-2：仓库版官方条文编号错误

仓库 `apply-core/GUIDE.md` 当前把：

- 三大件写成第七条；
- 特殊证明文件写成第八条；
- 前后各 30 页写成第九条。

官方现行文本对应第九、十一、十条。已安装 Codex 副本已经修正，仓库未回迁。

**影响**：插件把自己定位为“单一事实源”，条文编号错误会放大到全部子技能和交付材料。

**裁决**：P0 立即修正，并给 GUIDE 每条规则增加来源、性质和最后核验时间。

### P0-3：仓库版总校验存在假通过路径

仓库 `scripts/check_all.py` 当前行为：

- `source.selected_files/dirs` 为空时返回 `skip`；
- 功能说明路径为空或文件不存在时返回 `skip`；
- 总体状态只把 `fail` 和 `warn` 纳入聚合，`skip` 不改变 `PASS`；
- 不检查申请表、源码 PDF、说明书 PDF、身份证明是否真实存在；
- 不检查最终 PDF 页数、A4、文本或页眉；
- 不检查不足 3000 行时是否提交了全部源码。

**影响**：manifest 基本字段和日期通过时，缺少实质申请材料仍可能输出总体 `PASS`。

**裁决**：采用已安装副本的 fail-closed 方向，并补测试证明“缺一件必交材料必失败”。

### P0-4：AI 使用与新版申请表承诺存在冲突

本插件当前会：

- 用模型选择源码；
- 生成或改写功能说明；
- 整理说明书正文；
- 生成一致性报告和申请包自查表。

而 2026 新版申请表被公开转述为要求经办人手抄“未使用 AI 开发编写代码、撰写文档或生成登记申请材料”。即使该要求属于平台口径而非部门规章，插件也不能一边参与生成材料，一边仅提醒用户照抄承诺。

**裁决**：在任何材料生成前增加 AI 使用事实确认和 provenance 记录；发生冲突时不得宣称“可提交”，不得建议用户作不真实承诺。

建议 manifest 新增：

```json
{
  "ai_assistance": {
    "code": "yes|no|unknown",
    "manual": "yes|no|unknown",
    "application_materials": "yes|no|unknown",
    "current_workflow_used_ai": true,
    "provenance": [
      {
        "artifact": "功能说明.txt",
        "operation": "draft|rewrite|review|format-only",
        "actor": "human|llm|deterministic-tool",
        "timestamp": ""
      }
    ],
    "applicant_acknowledged": false
  }
}
```

硬门规则：

- 任一字段为 `unknown`：只允许继续盘点和只读检查，不出“可提交”结论；
- 本工作流已由 LLM 生成/改写申请材料：明确披露，不得指导签署相反承诺；
- 纯确定性排版、页码和文件转换应单独记录为 `deterministic-tool`，不与内容生成混淆；
- 最终处理方式由申请人依据实时表格、登记机构口径和专业意见决定。

### P1-1：源码“页数检查”仍基于原始行数推算

当前 `check_source.py`：

- 把原始总行数直接除以 50 折算页数；
- 空行和注释仍计入 `total_lines`；
- 注释、空行和重复仅在超过经验阈值时告警；
- 因而 3000 行中混有大量空行/注释时，仍可能被描述为足够组成 60 页；
- 没有真正产出“前 1500 + 后 1500”的确定行序列；
- 没有检查生成文件每一页是否恰好或至少 50 行。

**裁决**：把“统计源码”与“生成提交流”分开。页数必须基于清洗后的实际输出流和最终分页结果，而非源文件粗略行数。

### P1-2：注释、编码、忽略规则和隐私处理过弱

当前实现：

- 只用行首前缀判断注释，不能可靠识别块注释、Python 三引号、HTML/Vue 混合语法；
- 不能区分字符串里的 `//`、`#`、`<!--`；
- 强制 UTF-8 并用 replacement character 吞掉错误；
- 不读取 `.gitignore`；
- 没有文件大小、二进制和符号链接边界策略；
- 只提示用户人工遮掩密钥/个人信息，没有自动扫描和审计结果。

**裁决**：吸收 CodeSucker 的状态机、编码探测、忽略规则与敏感信息处理思想，并保存逐行来源映射。

### P1-3：规则没有独立版本与可追溯来源

现有 GUIDE 虽区分“官方”和“经验做法”，但缺少：

- `rulesVersion`；
- 每条规则的稳定 ID；
- 生效日期和失效日期；
- 来源 URL 与最后核验日期；
- 官方/平台/经验三类规则的默认严重度；
- 规则变化对旧 manifest 的迁移策略。

**裁决**：借鉴 CodeSucker 的产品版本、配置 schema 版本和规则版本分离设计。

建议：

```json
{
  "schema_version": 2,
  "plugin_version": "0.3.0",
  "rules_version": "2026.03.15.1",
  "rules_verified_at": "2026-08-21"
}
```

每个审计发现必须携带 `rule_id` 和 `rule_kind`：

- `official`：部门规章或稳定官方公开文件；
- `platform`：当前申请表或填报平台要求；
- `practice`：经验风险提示，只能 warn，除非另有明确依据。

### P1-4：跨申请重叠被过度硬化

当前 `check_overlap.py` 将完全相同文件直接判 fail，并把公共代码重复使用描述成必然驳回红线。现行《登记办法》没有直接规定“两个申请不得出现任何相同文件”。相同代码可能来自合法公共模块，也可能构成重复充数风险。

**裁决**：

- 完全相同文件默认改为 `warn/review-required`；
- 若 manifest 明确把同一文件分配给两个申请用于凑足材料，再升级为 fail；
- 输出共享代码的来源、许可证、归属和计入方式；
- 不把经验规则冒充官方硬性规则。

### P1-5：最终 PDF 验收仍不够闭环

已安装副本虽然新增 `check_pdf.py`，但目前主要抽样首页、中间页和末页：

- 不能证明 60 页每页都有正确页眉；
- 不能证明页码 1–60 连续；
- 不能证明每页实际包含至少 50 行代码；
- 无 `pdfplumber` 时只是弱校验；
- 没有通过渲染图片检查裁切、重叠、乱码和不可读字号。

**裁决**：最终 PDF 需要“结构检查 + 全页文本检查 + 视觉抽样/必要时全页渲染”三层验收。

### P1-6：没有专项测试、触发 eval 和 CI 门禁

本轮结果：

- 仓库根 `bun run validate` 通过，仅有与本插件无关的历史 warning；
- 仓库版和已安装版 Python 文件均可 `py_compile`；
- `crabcopyright-cn` 目录内没有 tests/evals；
- 根 CI 不运行软著插件脚本功能测试；
- 现有绿色校验只能证明 manifest/layout 等基础格式，不证明软著工作流正确。

**裁决**：建立确定性脚本测试、端到端材料 fixture 和 8 个技能的触发评测。

---

## 5. 目标架构

### 5.1 总体结构

```text
用户请求
  ↓
apply-manager（阶段判断、AI 合规闸门、依赖自检）
  ↓
application-planning / materials-checklist
  ↓
确定性引擎提出稳定的源码范围与顺序，用户确认软件边界
  ├─ 默认无 AI 内容生成模式：LLM 只解释规则与报告，不选择/改写提交材料
  └─ 披露式 AI 辅助模式：允许模型建议，但写入 provenance 且不得输出“未使用 AI”口径下的可提交结论
  ↓
copyright-source-core（确定性执行）
  ├─ discover：忽略规则、编码、二进制、文件元数据
  ├─ clean：状态机注释、空行、折行、脱敏、来源映射
  ├─ select：前后连续 1500 行、提交全部、页边界
  ├─ render：TXT/DOCX、页眉、页码、显式分页
  └─ audit：行数、署名、隐私、成立日期、规则版本
  ↓
Documents/PDF（DOCX→PDF、渲染）
  ↓
check_all（材料、PDF、说明书、日期、AI provenance、跨申请）
  ↓
filing-reviewer（独立只读复核）
  ↓
package-build / filing-guide
```

### 5.2 模型与确定性程序的职责边界

| 工作 | 责任主体 |
|---|---|
| 判断一个仓库应拆几个真实软件 | 默认由用户决定；模型建议仅限披露式 AI 辅助模式 |
| 判断哪些目录属于哪个软件 | 确定性仓库探测给候选、用户确认、manifest 固化 |
| 文件扫描、编码探测、排序执行 | 确定性程序 |
| 注释/空行/敏感信息处理 | 确定性程序，保留审计映射 |
| 前后 30 页截取与分页 | 确定性程序 |
| 语义上是否为自然模块开头/结尾 | 模型/人工复核 |
| DOCX/PDF 生成 | 确定性程序 + Documents/PDF |
| PDF 结构与渲染检查 | 确定性程序 + PDF 能力 |
| 申请材料真实性 | 申请人本人确认 |
| 新版申请表签字和承诺 | 申请人/经办人本人完成 |

### 5.3 建议产物

每个申请新增：

```text
outputs/<申请名>/
├── manifest.json
├── 中间态/
│   ├── source-selection.json
│   ├── source-audit.json
│   ├── source-line-map.jsonl
│   ├── 源代码材料.txt
│   ├── 源代码材料.docx
│   ├── 说明书定稿.docx
│   └── 功能说明.txt
├── 02-源代码鉴别材料.pdf
├── 03-说明书鉴别材料.pdf
├── 一致性校验报告.md
├── 材料自查对照表.md
└── audit-log.jsonl
```

`source-selection.json` 至少记录：

- 入选文件及顺序；
- 排除文件和排除原因；
- 原始/有效/输出行数；
- 前段末尾、后段开头；
- 每页起止文件与原行号；
- 清洗选项；
- 敏感信息替换数量；
- 文件 SHA-256；
- `rules_version` 和生成工具版本。

---

## 6. 实施方案

### Batch P0-A：权威源、事实源和假通过止血

目标：不引入 CodeSucker 代码，先把现有插件恢复成可审计、可复现、fail-closed 的状态。

实施项：

1. 修正仓库 `GUIDE.md` 的第九/十/十一条编号；
2. 从已安装副本选择性回迁：
   - `check_materials.py`；
   - `check_pdf.py`；
   - `check_manual.py`；
   - 增强版 `check_all.py`；
   - `check_dates.py` 的空申请日期 warning 行为；
3. 不回迁 `/Users/fushihua/...` 绝对路径、`.codex-plugin` manifest 和宿主特定文案；
4. 将仓库声明为唯一权威源；
5. 定义 CrabCode→Codex 发布转换与差异检查；
6. 为所有必交材料和所有 skip 路径加 fail-closed 测试；
7. 给 manifest 增加 `schema_version/plugin_version/rules_version`；
8. 给 AI 使用事实增加前置字段和阻断状态；
9. 把“跨申请相同文件必然 fail”降级为有条件的 review-required。

验收门：

- [x] 仓库 GUIDE 条文编号与国家版权局原文一致；
- [x] 缺少源码、功能说明、源码 PDF、说明书 PDF、申请表或身份证明时 `check_all` 必为 fail；
- [x] 申请日期为空不再取运行当天；
- [x] 同一 manifest 在不同日期运行结果一致；
- [x] 仓库通用源文件不出现开发机绝对路径；
- [x] 已安装包可由仓库同版本源重建；
- [x] AI 使用未知或冲突时不输出“可提交”。

### Batch P0-B：专项测试和 CI 基线

新增建议目录：

```text
tests/crabcopyright-cn/
├── fixtures/
├── check-all.test.ts
├── check-dates.test.ts
├── check-source.test.ts
├── check-overlap.test.ts
├── check-materials.test.ts
├── check-manual.test.ts
└── check-pdf.test.ts
```

如继续用 Python 脚本，可由 Bun 测试启动 Python 子进程，统一断言退出码与 JSON；CI 再增加 Python 3.9/3.13 语法与行为矩阵。

最低 fixture：

1. 完整单软件申请；
2. 缺一件必交材料；
3. 不足 3000 行但漏选文件；
4. 超过 3000 行但入选不足；
5. 3000 原始行、有效代码不足 3000；
6. 申请日期为空；
7. 开发完成晚于首次发表；
8. 企业成立晚于开发完成；
9. 两申请共享合法公共模块；
10. 两申请明显重复充数；
11. 空 PDF、伪 PDF、非 A4、页数错误；
12. DOCX 缺名称、版本号或关键章节。

验收门：

- [x] 已识别的历史 bug 有回归用例；
- [x] 当前本机 macOS/arm64、系统 Python 3.14 与强 PDF Python 3.12 通过；
- [x] 根工作流包含 `crabcopyright-cn` 专项门，但整个工作流仅可由 `workflow_dispatch` API/人工触发；
- [x] 本轮测试产物只写临时目录；
- [ ] 根 `bun run validate` 仍被并发任务中的 `cn-legal-study` 版本漂移阻断；`crabcopyright-cn` 专项测试与自身校验均绿色。Linux/Python 3.9/3.13 远程矩阵按用户要求未自动执行。

### Batch P1-A：锁定并引入 CodeSucker 纯核心

实施前决策门：

1. 成功 checkout 上游；
2. 锁定精确 40 位 commit；
3. 复核 Apache-2.0、NOTICE 和运行时依赖许可证；
4. 决定采用“源码移植”还是“独立实现同等算法”；
5. 明确不引入 Electron app。

推荐默认：在许可复核通过后，移植/适配 `discover/clean/select/render/audit` 纯核心，并编译成随插件分发的固定 bundle；不要运行时 `npm install`，不要依赖浮动 `latest`。

建议结构（前置审计收敛后）：

```text
plugins/crabcopyright-cn/
├── package.json                    # 与插件/Marketplace 同版本，避免第四套版本源
├── bun.lock
├── src/
│   └── source-core-cli.ts          # 本地适配层，不修改上游 vendor 文件
├── vendor/codesucker-core/
│   └── src/                        # 锁定提交的原样纯 core 源码，不含 Electron/UI
├── tests/
├── dist/source-core.js             # 预构建离线 bundle，运行时不安装依赖
├── docs/legal/
│   ├── SOURCE-LOCK.json
│   ├── PORTING-MAP.md
│   ├── THIRD_PARTY_NOTICES.md
│   ├── LICENSE-CodeSucker.txt
│   └── upstream-NOTICE.txt
└── scripts/
    └── check-source-core-distribution.ts
```

若直接移植源码，必须：

- 保留 Apache-2.0 许可；
- 保留适用版权和 NOTICE；
- 在修改文件中醒目标明已修改；
- 记录上游路径→本地路径映射；
- 提供可复现差异或来源验证；
- 不使用 CodeSucker 商标暗示官方合作或背书。

验收门：

- [x] 上游 commit 和源文件哈希锁定；
- [x] bundle 可离线运行；
- [x] 冷启动不下载依赖；
- [x] 许可证、NOTICE 和第三方依赖归属齐备；
- [x] 可按 SOURCE-LOCK、逐文件 blob 和移植映射复核差异；
- [x] core 与 Electron/UI 解耦。

### Batch P1-B：确定性源码流水线接入 manifest

实现：

1. `discover`：
   - `.gitignore` + 默认规则 + 用户规则；
   - 文件大小、二进制、符号链接和编码边界；
   - 稳定排序和错误清单；
2. `clean`：
   - 逐字符状态机；
   - 可配置空行/注释/Tab/折行；
   - 敏感信息扫描与替换；
   - 原文件/原行号映射；
3. `select`：
   - 清洗后有效输出流；
   - `≤3000` 全部提交；
   - `>3000` 前 1500 + 后 1500；
   - 每页 50 行显式分页；
4. `audit`：
   - 空结果、短页、页边界；
   - 署名冲突；
   - 敏感信息残留；
   - 文件日期与主体成立日期；
   - 规则 ID 和证据位置；
5. `render`：
   - TXT 备查；
   - DOCX 页眉、页码、A4、固定行距、显式分页；
6. 写回 manifest 和 audit log。

验收门：

- [x] `https://example.com` 中的 `//` 不被误删；
- [x] Python 三引号、HTML/Vue 注释和 C 风格块注释有测试；
- [x] GB18030/UTF-8 源码不出现静默替换字符；
- [x] 二进制、超大文件、`.gitignore` 和第三方/忽略目录不进入材料；
- [x] 3001+ 行输出严格为 3000 行；
- [x] 第 1–30 页来自前段，第 31–60 页来自后段；
- [x] 每页准确记录 50 行及来源位置；
- [x] 不足 3000 行时覆盖全部合格源码并保留人工范围确认告警；
- [x] 脱敏前后有审计记录，但日志不泄露原始秘密；
- [x] 相同输入、配置和规则版本产生相同哈希。

### Batch P1-C：PDF 与说明书成品闭环

1. DOCX 交给 Documents/PDF 转换；
2. 最终 PDF 全页检查：
   - 页数；
   - A4；
   - 每页名称和版本号；
   - 页码连续；
   - 页边界与生成时的 page manifest 对应；
3. 渲染首页、中间页、前后段交界页和末页；高风险时全页渲染；
4. 检查乱码、裁切、重叠、过小字号和空白页；
5. 说明书增加截图实际存在性、图片清晰度和功能→源码对应关系检查；
6. PDF 每次更新后自动使旧一致性报告失效并重跑。

验收门：

- [x] 60 页源码成品和不足 60 页全量分支均有确定性测试；
- [x] 真实转换的 60 页 PDF 每页页眉和页码均通过全页抽取检查；
- [x] DOCX 显式分页与 `source-line-map.jsonl`/page manifest 一致；PDF 文本提取未作为物理行数的唯一证据；
- [ ] 真实申请说明书截图属于逐申请材料，当前没有用户申请数据，不能伪造；插件已实现路径存在性、localhost/生产域名和隐私告警；
- [x] 脱敏源码 PDF 已完成 60 页结构与全页视觉验收。

### Batch P2-A：规则注册表与迁移

新增机器可读规则注册表，例如：

```text
plugins/crabcopyright-cn/apply-core/rules/
├── rules.schema.json
├── 2002-registration-method.json
├── 2017-fee-suspension.json
└── 2026-application-form.json
```

每条规则字段：

- `id`；
- `kind`；
- `title`；
- `source_url`；
- `effective_from`；
- `effective_to`；
- `last_verified_at`；
- `severity`；
- `mechanical_check`；
- `notes`。

规则版本变化时：

- 旧 manifest 不静默升级；
- 运行迁移并记录前后版本；
- 规则过期或来源不可核验时降级为 warning/review-required；
- 平台规则和经验规则不得覆盖官方规则标签。

### Batch P2-B：技能触发与质量评测

按 `skill-creator` 流程增加：

```text
plugins/crabcopyright-cn/evals/
├── evals.json
└── trigger-evals.json
```

工作流 eval 至少覆盖：

1. “帮我申请软著”触发 `apply-manager`；
2. monorepo 多申请触发 `application-planning`；
3. “办软著需要什么”触发 `materials-checklist`；
4. “生成60页源码”触发 `source-code-material`；
5. “把说明书整理成PDF”触发 `manual-material`；
6. “核对名称版本号”触发 `consistency-check`；
7. “打包提交”触发 `package-build`；
8. “平台字段怎么填”触发 `filing-guide`；
9. 专利、商标、普通作品登记等近似负例不应误触发；
10. 仅要求通用 PDF 转换时应由 PDF/Documents 能力处理，而不是软著总管家抢占。

每个可客观判定的 eval 增加 assertions：

- 是否读取 GUIDE/MANIFEST；
- 是否先做依赖和 AI 合规自检；
- 是否产生预期 manifest 字段；
- 是否运行确定性脚本；
- 是否在材料缺失时拒绝“可提交”；
- 是否保留人工确认点；
- 是否没有伪造或代签建议。

改造前版本作为 baseline，改造后做 with-skill 对比，生成 benchmark 与人工评审页。当前文档只规划该流程，不提前创建 eval 结果或宣称分数提升。

### Batch P2-C：发布与回归门禁

发布前必须：

1. 根仓 `bun run validate`；
2. `crabcopyright-cn` 专项测试；
3. Python/Node/Bun 兼容测试；
4. source-core bundle 新鲜度检查；
5. NOTICE/许可证/SBOM 检查；
6. 旧 manifest 迁移测试；
7. CrabCode 插件装载测试；
8. Codex 转换包装载与技能发现测试；
9. 一个真实但脱敏的项目端到端生成；
10. PDF 渲染验收；
11. Marketplace、README、版本和变更记录同步；
12. 发布后冷启动，不依赖开发机绝对路径。

---

## 7. 建议提交拆分

| 批次 | 建议提交主题 | 是否引入上游代码 |
|---|---|---|
| P0-A | `fix(crabcopyright-cn): reconcile canonical rules and fail-closed checks` | 否 |
| P0-B | `test(crabcopyright-cn): add deterministic validation matrix` | 否 |
| P1-A | `feat(crabcopyright-cn): vendor pinned source material core` | 是/取决于最终裁决 |
| P1-B | `feat(crabcopyright-cn): generate traceable 60-page source artifacts` | 可能 |
| P1-C | `feat(crabcopyright-cn): close final PDF and manual QA loop` | 否 |
| P2-A | `feat(crabcopyright-cn): version compliance rules and manifest schema` | 否 |
| P2-B | `test(crabcopyright-cn): add skill trigger and workflow evals` | 否 |
| P2-C | `ci(crabcopyright-cn): enforce provenance and release gates` | 否 |

每个批次独立可回滚，不把事实源修复、上游移植、功能扩展和版本发布揉成一个巨型提交。

---

## 8. 风险与控制

| 风险 | 严重度 | 控制措施 |
|---|---|---|
| 用户签署与实际 AI 使用不一致 | 阻断 | AI provenance + 前置确认 + 禁止虚假“可提交”结论 |
| 仓库与安装副本继续漂移 | 阻断 | 单一权威源 + 生成式发布 + 差异门禁 |
| 原始 3000 行被误当有效 3000 行 | 阻断 | 基于清洗后输出流分页 |
| 敏感信息进入源码材料 | 阻断 | 自动扫描、可审计脱敏、最终 PDF 复检 |
| 错误删除字符串或合法代码 | 高 | 状态机 + 多语言 fixture + 行映射 |
| CodeSucker 移植许可不完整 | 高 | commit 锁定、Apache/NOTICE、修改声明、SBOM |
| 公共代码重叠被误判必驳回 | 高 | official/platform/practice 分级，默认人工复核 |
| PDF 看似存在但版式不可提交 | 高 | 全页结构检查 + 渲染验收 |
| 规则更新后旧申请静默改变 | 高 | `rules_version` + manifest 迁移日志 |
| 技能互相抢触发 | 中 | trigger eval 与近似负例 |
| 上游更新破坏本地适配 | 中 | SOURCE-LOCK + 差异测试，不跟随浮动 main/latest |

---

## 9. 明确不做

本实施方案不授权以下行为：

- 不自动替用户完成实名、本人签名、手抄承诺或最终提交；
- 不在申请包中保存身份证号等敏感身份信息；
- 不伪造开发记录、源代码、截图、发表日期或权属证明；
- 不用空行、注释、重复模板或折行结果人为凑页；
- 不把经验规则写成官方强制规则；
- 不把 CodeSucker Electron 应用整体嵌入插件；
- 不从 GitHub `main` 或 npm `latest` 运行时动态下载代码；
- 不在未锁定上游提交和完成 NOTICE 审计前复制源码；
- 不因脚本 PASS 取代申请人的真实性确认和专业复核。

---

## 10. 完成定义

只有同时满足以下条件，才能宣称本轮优化完成：

- [x] 仓库是唯一权威源，CrabCode/Codex 两种发布形态可重现；
- [x] GUIDE、规则注册表和官方/平台来源一致；
- [x] AI 使用事实已记录，冲突场景 fail-closed；
- [x] 源码材料由确定性流水线生成，不再只靠模型按提示排版；
- [x] 每页、每行都能追溯到原文件、原行号和处理规则；
- [x] 源码 DOCX/PDF 样本通过结构和视觉验收；真实说明书仍按每个申请单独验收；
- [x] 必交材料缺失不可能得到总体 PASS；
- [x] 多语言、编码、隐私、署名、日期和跨申请场景有回归测试；
- [x] 8 个技能有正向、负向和边界触发 eval；
- [x] 上游许可、NOTICE、commit、源文件哈希、修改记录和 SBOM 完整；
- [x] 脱敏源码端到端、个人宿主冷启动和本机发布门通过；自动 CI 已按用户要求暂停，远程 OS/Python 矩阵未冒充已执行；
- [x] README、Marketplace、插件/package 版本和第三方声明同步；本插件原先没有独立 CHANGELOG，不为勾选清单制造空文件。

---

## 11. 推荐执行顺序

```text
P0-A 权威源与假通过止血
  → P0-B 专项测试基线
  → P1-A 上游锁定与纯核心引入
  → P1-B 确定性源码流水线
  → P1-C PDF/说明书成品闭环
  → P2-A 规则版本与迁移
  → P2-B 技能 eval
  → P2-C 发布门禁与真实项目验收
```

P0-A/P0-B 可以立即开始，不依赖 CodeSucker checkout；P1-A 只有在上游源码与许可证据完整后才能启动。

---

## 12. 初次只读审计记录（实施前）

以下仅记录实施开始前的基线，最终状态以第 14 节为准：

- `bun run validate`：退出码 0；输出中的 warning 与 `crabcopyright-cn` 无关；
- 仓库版 5 个 Python 脚本：`py_compile` 通过；
- 已安装 Codex 副本 8 个 Python 脚本：`py_compile` 通过；
- `crabcopyright-cn` 专项 tests/evals：未发现；
- Git 工作树：审计开始前无本插件未提交改动；
- 当时尚未修改插件实现、版本、Marketplace 或安装副本。

实施阶段已把实际版本、验证命令、测试数量、未决风险和偏离本方案的理由追加到第 14 节，
不用“已优化”替代可核验记录。

---

## 13. 实施前置审计（2026-08-21）

### 13.1 结论

前置审计结论为：**附修订通过，可以实施**。

方案的主线——保留申请编排、引入确定性源码内核、补 fail-closed 校验、规则版本、测试与双宿主发布——与当前缺陷匹配。没有发现需要终止整个项目的许可、法规或仓库结构阻断。

已锁定的上游发布事实：

- CodeSucker 正式版本：`v0.4.5`；
- annotated tag object：`9ed5137e83a1cb495fd3ab5d7f3d1f5a450e424d`；
- 对应 commit：`2e39375cf6891b9d958c277f1c6eb3b5104814d9`；
- 发布时间：2026-08-21；
- 许可：Apache-2.0，包含 NOTICE；
- 只移植 `packages/core/src` 所需纯核心，不移植 Electron、UI、更新检测、最近项目和窗口状态。

### 13.2 方案合理性

合理且应保留的部分：

1. 先 P0 止血再引入上游，避免在错误事实源上叠加新功能；
2. 仓库作为唯一权威源，Codex 安装副本由仓库生成；
3. 源码清洗/分页交确定性程序，模型不再自述已完成；
4. CodeSucker core 与申请全流程形成互补，不重复开发 Electron UI；
5. 上游 commit、NOTICE、依赖归属和 bundle 新鲜度进入本机发布门，并保留在 API/人工触发的全局 CI 中；
6. PDF 结构检查和视觉检查并存；
7. 规则区分 official/platform/practice；
8. 技能正例、近似负例和旧版 baseline 同时评测。

### 13.3 过度设计收敛

识别并收敛两项过度设计：

1. **不建立嵌套 `source-core/package.json`**。改为插件根单一 `package.json`，版本与 `.crabcode-plugin/plugin.json`、Marketplace 同步；减少依赖、锁文件和版本源数量。
2. **不把 PDF 文本提取当作每页 50 行的权威证据**。物理行数由生成时 page manifest、显式分页和 OOXML 结构证明；PDF 层负责页数、A4、页眉、页码、可读性与视觉缺陷。PDF 文本提取仅作交叉检查。

规则注册表保留，但采用一个 `rules.json` + 一个 `rules.schema.json` + 确定性校验器；当前仅三组规则时不拆成无消费者的多文件框架。

### 13.4 原方案遗漏及补充裁决

1. **办公套件关联能力**：仓库内 `crabcode-office-suite/src/docx` 与 `src/pdf` 仍是占位适配层；不能把 CrabCode 侧 DOCX/PDF 生成视为已交付。源码内核必须自行生成 DOCX；PDF 转换采取“Codex Documents/PDF 或本机 LibreOffice 可用时执行，否则明确 blocked”的能力探测，不能假完成。
2. **第三方/开源代码权属**：除 `@author`/Copyright 外，增加 SPDX、许可证头、vendor/generated 目录和疑似第三方代码告警；默认不把第三方依赖源码计入自研材料。
3. **路径与隐私**：manifest 和 line map 存相对 POSIX 路径；最终申请包不携带本机绝对路径、source-line-map、审计日志或秘密证据。中间态与提交件建立明确白名单。
4. **Git 日期证据**：文件 mtime 受 checkout 影响，只能是 practice warning；Git 最早提交时间可作辅助证据，但不替代申请人声明。
5. **确定性哈希**：内容哈希不包含运行时间和本机绝对路径；时间戳只进入独立 audit log，避免相同输入产生不同材料哈希。
6. **manifest 契约**：增加 `manifest.schema.json`、原子写入和 `migrate_manifest.py`；旧 manifest 不静默升级。产物保存 SHA-256 与 `validated_against`，源文件/PDF 改变后旧校验自动失效。
7. **安全边界**：扫描器只读文件，不执行项目脚本、Git hooks、编译器或动态模块；拒绝越出源码根的符号链接和输出路径穿越；限制单文件大小、总文件数和证据条数。
8. **“全部源码”定义**：不足 3000 行时的“全部”是用户确认的软件范围内、经排除规则过滤后的全部合格自研源码，不是整个 monorepo，也不是第三方/vendor/generated 文件。

### 13.5 关联方影响

| 关联方 | 影响 | 处理 |
|---|---|---|
| 根 Marketplace/版本校验器 | 新增插件根 `package.json` 后形成第三条版本一致性腿 | 插件、package、Marketplace 同步升至 `0.3.0` |
| 根 CI | 增加 Bun/Node/Python 和 bundle 新鲜度成本 | 独立 `crabcopyright-plugin` job；自动触发全部暂停，仅由全局 `workflow_dispatch` API/人工启动，不改变其他插件测试语义 |
| `crabcode-office-suite` | 当前运行时占位，不能承诺 CrabCode 侧自动转 PDF | 不修改其公共 API；本插件做能力探测和明确降级 |
| Codex Documents/PDF | 当前本机已安装且可用于成品 QA | 仅在 Codex 端调用；不把其绝对路径写入仓库产物 |
| 个人 Codex Marketplace | 已指向 `/Users/fushihua/plugins/crabcopyright-cn` | 仓库实现完成后由生成脚本更新副本，再按 cachebuster 流程重装 |
| 现有 manifest 用户 | schema v1 将升级 | 提供显式迁移、备份和兼容读取；不原地静默覆盖 |
| 其他仓库插件 | 没有发现对本插件脚本/字段的程序性依赖 | 仅同步能力路由示例和文档，不改其他插件运行逻辑 |
| CodeSucker 权利人与依赖作者 | 发生源码再分发和 bundle 分发 | 保留 Apache-2.0、NOTICE、修改/适配说明和依赖归属 |

### 13.6 修订后的实施门

实施按下列顺序推进：

1. P0：事实源、AI 闸门、manifest schema/migration、fail-closed 校验与测试；
2. P1：锁定并原样 vendor CodeSucker 纯 core，外置本地适配层，生成离线 bundle；
3. P1：接入 manifest、相对路径、line map、第三方代码和隐私审计；
4. P1：DOCX 自生成，PDF 能力探测和结构/视觉验收；
5. P2：单一规则注册表、技能 eval、API/人工触发 CI 与双宿主生成；
6. 终检：真实脱敏 fixture、许可证、版本、安装副本和新线程装载验证。

前置审计通过不代表后续任何单项可以跳过自己的验收门；上游文件未能按 SOURCE-LOCK 取得、bundle 无法重建、AI 冲突未 fail-closed 或 PDF 未完成视觉验收时，整体状态仍必须保持 blocked。

---

## 14. 全量实施与本机验收记录（2026-08-21）

### 14.1 实施结论

前置审计所列 P0、P1、P2 软件实现已完成，插件版本统一为 `0.3.0`。实施遵循第 13 节的
收敛裁决，没有引入 CodeSucker Electron/UI，也没有修改 `crabcode-office-suite` 的占位公共
接口。新增能力的主要落点如下：

- `src/source-core-cli.ts`：确定性源码适配层、manifest v2、路径/符号链接边界、逐行映射、
  脱敏审计、稳定 TXT/DOCX、原子写入和哈希；
- `vendor/codesucker-core/src/`：锁定提交的 11 个逐字节一致纯 core 文件；
- `docs/legal/`：SOURCE-LOCK、Apache-2.0、NOTICE、上游第三方声明、移植映射和 CycloneDX SBOM；
- `apply-core/rules/`、`apply-core/schemas/`：单一规则注册表、schema 与 manifest v2 契约；
- `scripts/`：迁移、AI、规则、材料、源码中间态、DOCX/PDF 绑定、最终总门、申请包白名单、
  分发新鲜度和来源锁校验；
- 8 个技能与 3 个只读代理：统一采用真实能力探测、AI 硬门、确定性生成和最终材料失效重验；
- `evals/` 与 `tests/crabcopyright-cn/`：工作流 eval、触发边界、历史缺陷与强 PDF 回归。

manifest 模式的显式 `--output-dir` 也已在终检中进一步收紧：输出只能位于申请目录内，
不能借相对路径、绝对路径或符号链接把中间态写出申请边界。

### 14.2 上游与供应链证据

| 项目 | 实际结果 |
|---|---|
| CodeSucker release | `v0.4.5` |
| annotated tag object | `9ed5137e83a1cb495fd3ab5d7f3d1f5a450e424d` |
| commit | `2e39375cf6891b9d958c277f1c6eb3b5104814d9` |
| commit tree | `7ee450b0caf44175e666cfabba6ab5668aa3e49b` |
| core tree | `cb277b12a6328ec92c8c2d7ab3adb30584142880` |
| vendor 核验 | 11 个文件、148,651 字节，Git blob SHA-1 与 SHA-256 全部匹配 |
| 分发 bundle | `dist/source-core.js`，1,608,149 字节，离线自包含 |
| SBOM | 45 个锁定组件与 `bun.lock`、`package.json@0.3.0` 一致 |
| 许可 | Apache-2.0、NOTICE、上游 THIRD_PARTY_NOTICES 和本地再分发说明齐备 |

### 14.3 本机测试矩阵

本轮没有调用远程 CI，以下均在本机执行。环境为 macOS 26.5.2 arm64；根仓 Bun 1.3.14、
插件锁定工具链 Bun 1.3.11、Node v24.18.0、系统 Python 3.14.5、强 PDF 依赖环境 Python 3.12.13。

| 本机门禁 | 结果 |
|---|---|
| 插件 `bun install --frozen-lockfile` | PASS，无依赖变化 |
| 根仓与插件 `typecheck` | PASS |
| 插件 source-core/Codex port 测试 | 11 pass / 0 fail，104 assertions |
| 强依赖规则、材料、PDF、eval 测试 | 14 pass / 0 fail，68 assertions |
| `verify-codesucker-port.ts` | PASS，11 文件 / 148,651 字节 |
| bundle 新鲜度 | PASS，1,608,149 字节 |
| `sbom:check` | PASS，45 组件 |
| Python `py_compile` | PASS，17 个脚本 |
| 根仓 `typecheck`、`build`、brand lint | PASS |
| `actionlint .github/workflows/*.yml` | PASS |
| 个人宿主包结构 + 8 个技能 quick validate | 全部 PASS |
| 根仓全套 `bun test ./tests/` | 250 pass / 8 skip / 0 fail，2,607 assertions |
| 根仓 `bun run validate` | PASS；仅输出仓库既有 warning，无本插件 error |

最终复核分支已 rebase 到 `origin/main@2e0b1266dcc4c34f8930cd589ce7aaedd6aa0f10`，未带入原工作区并发的其他插件和审计文档。
Linux/macOS、Python 3.9/3.13 的远程矩阵仍保留在手动工作流中，
但按用户要求没有自动运行，
本报告不把未执行的远程矩阵写成已通过。

### 14.4 真实 DOCX/PDF 成品验收

用锁定的上游 core 源码制作了脱敏 60 页源码样本，DOCX 经实际 LibreOffice 渲染为 PDF：

- DOCX SHA-256：`dd5545d5b3a7349a05dfdda82b7c5718d148641fa530153819f23f4739854fe6`；
- PDF SHA-256：`ffeee2b73eab1766444b7c3305fd538d07a7731874a18c387a40c237a0abffa8`；
- PDF：60 页、A4、1,044,113 字节；
- 强 PDF 校验逐页检查 60 页文本、软件名、版本号、页眉和页码，结果 PASS；
- 60 页全部渲染为 PNG，并检查 6 张十页联系表以及第 1、30、31、60 页原图；未发现裁切、
  重叠、空白页、页眉缺失或前后段交界错误。

QA 产物仅保存在 `/private/tmp/crabcopyright-source-core-qa/`，不进入仓库或最终提交白名单。
当前没有用户的真实申请表、说明书和截图，因此没有伪造一份“完整申请包”；这些材料必须在
每个真实申请中由申请人提供并重新完成隐私、哈希和视觉验收。

### 14.5 技能 eval

三组配对工作流 eval、每组四项断言的单次结果为：

- 新版：12/12，100%；
- 改造前快照：7/12，58.3%；
- 增益集中于 manifest v2 迁移、当前 source-core 工具链、`check_ai.py + check_all.py` 双门，
  以及 package-build 不得用人工接受 warning 覆盖 AI blocked。

这是单次、三场景对比，不代表随机重复稳定性；运行时没有暴露真实耗时和模型 token，
benchmark 中 `time_seconds=0` 是不可用哨兵，`tokens` 实为输出字符数代理。静态人工评审页：
`docs/audit/2026-08-21-crabcopyright-cn-v0.3.0-eval-review.html`。

### 14.6 CI 暂停与手动触发

仓库三个 GitHub Actions 工作流现均只声明 `workflow_dispatch`：

- `.github/workflows/ci.yml`：全局验证工作流；
- `.github/workflows/publish-to-cn-mirror.yml`：只能从官方仓 `main` 人工发布镜像；
- `.github/workflows/notify-mirror.yml`：镜像新鲜度只读审计。

`push`、`pull_request`、`schedule` 等自动触发已全部移除。全局 CI 只能由 GitHub UI 或
workflow dispatch API 人工启动；推荐顺序为“本机测试 → 手动全局 CI → 手动镜像发布 →
手动镜像审计”。发布 job 额外拒绝非 `main` ref，镜像审计只接受成功的手动全局 CI 记录。
本轮所有测试均在本机完成，没有制造远程绿色状态。

### 14.7 双宿主安装状态

- 仓库/CrabCode 权威源版本：`0.3.0`；
- 个人 Codex 已安装并启用：`0.3.0+codex.20260822144208`；
- 安装缓存：`/Users/fushihua/.codex/plugins/cache/personal/crabcopyright-cn/0.3.0+codex.20260822144208`；
- 仓库 bundle 与安装缓存 bundle SHA-256 均为
  `bff7426674aba8c31b2b49e2786afa36be491a32dfc537df797b99b3c4acdad4`；
- 可恢复备份：`/Users/fushihua/plugins/crabcopyright-cn.backup-0.2.0-20260821`、
  `/Users/fushihua/plugins/crabcopyright-cn.backup-0.3.0-20260822060109` 和
  `/Users/fushihua/plugins/crabcopyright-cn.backup-0.3.0-codex.20260822060109`、
  `/Users/fushihua/plugins/crabcopyright-cn.backup-0.3.0-codex.20260822060741`。

新安装技能需在新的 Codex 任务中重新发现；当前已打开的任务不会热重载技能目录。

### 14.8 最终边界与未决事项

本轮“实施完成”指插件软件、规则、测试、分发和脱敏源码成品链路完成，不代表任何特定申请
已经具备真实提交条件。仍需逐申请完成：申请人/权属事实确认、最新版平台页面复核、真实
说明书与截图、身份证明及特殊权属材料、本人签名/承诺和最终 PDF 复验。

最新 `main` 隔离基线没有根级红灯，也没有发现 `crabcopyright-cn` 自身遗留 fail。
复核结论准予合并；提交与合并哈希以 Git 历史为准。本轮未触发任何远程 CI、发布或镜像审计。

---

## 15. 交付后复核审计（2026-08-22）

### 15.1 隔离与关联方审计

原工作区位于 `codex/crablaw-legal-skills-research-plan`，并混有非本任务审计文档和
`cn-legal-study` 并发改动。为避免把关联方内容带入发布，最终交付没有在该脏工作区直接
提交，而是先从 `origin/main@1e808becab96e67e0684d8301411879eca674309` 创建
`codex/crabcopyright-cn-v0.3.0` 隔离工作树；断电恢复后再 rebase 到
`origin/main@2e0b1266dcc4c34f8930cd589ce7aaedd6aa0f10`，只迁移以下范围：

- `plugins/crabcopyright-cn/`；
- `tests/crabcopyright-cn/` 与工作流技能内容指纹；
- 本报告和静态 eval 评审页；
- Marketplace 中仅 `crabcopyright-cn` 条目；
- vendor/dist/legal 的 `.gitignore` 例外与最小 brand allowlist；
- 全局 CI、镜像发布、镜像审计三个工作流的手动触发改造。

没有带入原工作区的 `cn-legal-study` 版本变化、其他审计文档或 CrabLaw 改动。

### 15.2 复核发现与处置

| 发现 | 级别 | 处置 |
|---|---|---|
| 最新 `main` 新增了 push 自动镜像发布，原报告只覆盖两个工作流 | 阻断 | 三个工作流全部改为仅 `workflow_dispatch`；发布仅允许官方仓 `main`，并固定 checkout action 提交 |
| 8 个技能正文变化但全仓模型内容指纹仍为旧值 | 阻断 | 合并远端新增工作流后保持 316 个调用身份不变，仅把确定性模型内容 SHA-256 更新为审计后的新值 |
| 手动 CI 迁移期间镜像审计需要识别历史成功记录 | 兼容性 | 工作流仍只有 `workflow_dispatch`；只读查询不按 event 过滤，兼容历史记录且不会触发运行 |
| Python 材料脚本先 `resolve()` 再判 `is_symlink()`，会丢失指向目录内文件的链接身份 | 高 | 新增共享 `contained_path`，在材料记录、哈希校验、打包、日志和输出路径上拒绝任一申请目录内符号链接，并增加三层回归 |
| Codex port 仍残留不带 FQN 的 `crabcode-office-suite` 宿主文案 | 中 | 仅在个人宿主技能生成阶段改写为当前宿主文档/PDF能力，测试升级为不得残留任何该宿主名 |
| 原工作区根测试被并发 `cn-legal-study` 版本漂移污染 | 关联方 | 不修改关联方；在最新 `main` 隔离基线复跑后版本一致、根测试全绿 |

### 15.3 最终本机证据

- `bun install --frozen-lockfile`：根仓与插件均通过；
- 根仓/插件 TypeScript：通过；17 个 Python 脚本 `py_compile`：通过；
- 插件测试：11 pass / 0 fail，104 assertions；
- 强 PDF/材料/eval：14 pass / 0 fail，68 assertions；
- 根仓测试：250 pass / 8 skip / 0 fail，2,607 assertions；
- `bun run validate`：退出码 0，仅既有 warning；
- root build、brand lint、`actionlint`、`git diff --check`：通过；
- CodeSucker 锁：11 文件 / 148,651 字节；bundle：1,608,149 字节；SBOM：45 组件；
- 三个 workflow 的事件扫描结果仅有三个 `workflow_dispatch`，无 push、PR、schedule；
- 个人 Codex 源与安装缓存逐文件一致，bundle SHA-256 与仓库均为
  `bff7426674aba8c31b2b49e2786afa36be491a32dfc537df797b99b3c4acdad4`。

### 15.4 最终结论

交付后复核审计结论：**通过，准予合并推送**。

没有未处置的 P0/P1、许可缺口、AI 承诺绕过、材料假通过、路径越界、符号链接绕过、
版本漂移或自动 CI 触发。8 个 skip 均为需要额外上游 checkout 的既有 CrabCode Security
差分测试，以及在普通根测试中由强依赖专项单独覆盖的 PDF 用例；本轮强 PDF 用例已实际通过。

该结论仍不代表任何具体软著申请已经可提交；真实申请必须按第 14.8 节逐案复核。
