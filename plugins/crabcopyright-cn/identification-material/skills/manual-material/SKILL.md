---
name: 说明书鉴别材料制作
short-description: 整理软件说明书并生成含封面、目录和功能截图的规范材料
description: 把软件说明书/用户手册的 Word 文档(.doc/.docx)整理成符合中国版权保护中心规范的软著文档鉴别材料 PDF(封面、目录、概述、功能说明含截图、运行环境;每页≥30行;页眉含软件名+版本号),核心是引导用 crabcode-office-suite 办公套件处理 Word 文档并导出 PDF。当用户说"整理软著说明书""生成文档鉴别材料""软著说明书怎么写/怎么排版""把 word 说明书弄成软著要的 PDF""说明书要加封面目录页码",或软著申请管家分派到说明书环节时使用。
argument-hint: "[说明书doc/docx路径] [软件全称] [版本号]"
allowed-tools:
  - Read
  - Write
  - Task
  - AskUserQuestion
  - Bash(python3:*)
---

# 说明书鉴别材料制作

把 `$MANUAL_PATH` 指向的 Word 说明书整理成规范的文档鉴别材料 PDF。**先读**
`${CRABCODE_PLUGIN_ROOT}/apply-core/GUIDE.md` §4——文档类型、页数行数、章节、截图、
一致性红线以它为准。

## AI 使用硬门

先运行 `check_ai.py`。若用户准备作“未使用 AI”承诺，本技能只能整理用户本人提供的
真实说明书并做确定性格式处理，不能代写、扩写或改写正文。若用户明确要求模型撰写/
改写，先写入 provenance 和 `current_workflow_used_ai=true`，最终提交门保持 blocked，
不得建议用户作相反承诺。

开工先读该申请的 `outputs/<申请名>/manifest.json`(结构见
`${CRABCODE_PLUGIN_ROOT}/apply-core/MANIFEST.md`)取软件全称/版本号、`manual.source_path`
与 `manual.screenshot_plan`,不靠口头交接。截图清单缺失或粗糙时,可用 Task 派发
**manual-evidence-collector** 子代理(只读)从路由表与 dev 配置核对细化,核对采用后
写回 `manual.screenshot_plan`。无 AI 模式下它只核对客观路由，不替用户编造功能描述。
每个实际截图在清单中补 `image_path`；只有 URL/计划而没有真实图片时只能标 warning。
完工把 `manual.doc_type`、`intermediates.manual_docx`
(定稿 docx 路径)、`materials["03-说明书鉴别材料.pdf"]` 写回 manifest,
`steps.manual-material` 置 `done`。

## 何时用 crabcode-office-suite 办公套件、用哪个技能

Word 文档的读、改、排版、转 PDF 交给实际可执行的文档能力——本技能负责判断"该做成什么样",
办公套件负责"具体怎么操作 Word/PDF"。按场景对号入座,**点名对应办公套件技能**
(它们各有触发词,会在相应场景被唤起):

| 场景 | 用哪个办公套件技能 |
|------|------|
| 读取现有 .doc/.docx 结构、提取章节大纲 | `crabcode-office-suite:crabcode-documents` |
| 新建/补全说明书正文,插入封面、自动目录、页眉页码、插入界面截图、查找替换 | `crabcode-office-suite:crabcode-documents` |
| 旧版 `.doc` 转 `.docx`、接受修订、清除个人信息痕迹 | `crabcode-office-suite:crabcode-documents` |
| 定稿 .docx 转 PDF、合并/加页码、按前30+后30页取页 | `crabcode-office-suite:crabcode-pdf` |
| 说明书里要嵌数据表格 | `crabcode-office-suite:crabcode-spreadsheets` |

典型链路:`crabcode-office-suite:crabcode-documents`(整理排版 Word)→
`crabcode-office-suite:crabcode-pdf`(导出规范 PDF)。若触发时报 Unknown skill,
或运行时返回 NOT_IMPLEMENTED,都说明当前能力不可执行:引导用户安装/启用可用的
Documents/PDF 或 LibreOffice 后重试。只有技能说明但适配器未实现不算可用；此时状态
必须 blocked,不得假装已产出 DOCX/PDF。

## 说明书应具备的结构（择文档类型）

- **用户手册/操作说明书**(有 UI 的软件):封面 → 目录 → 概述(开发目的/简介) →
  运行环境 → 安装说明 → **功能模块操作说明(每功能配界面截图 + 文字)** → 注意事项。
  至少含登录界面、主界面、各核心功能界面截图。
- **设计说明书**(无 UI 的底层/算法):引言 → 总体设计 → 逐模块程序描述
  (功能/输入输出/算法/接口/限制),配流程图/结构图。

## 排版规则

- 页眉 `${SOFTWARE_NAME} ${VERSION}`,右侧连续页码;**封面不计页数**,页码从目录/正文起。
- 每页 ≥30 行(截图页、末页可例外)。正文字体统一(宋体/仿宋)。
- **功能描述必须与源代码对应**——文档写了的功能,源码里要能找到,否则驳回。
- 截图中的软件名称须与 `$SOFTWARE_NAME` 一致;清除作者名等个人信息;网址建议用 `localhost`。
- 截图必须来自真实开发环境,路径写入 `manual.screenshot_plan[].image_path`;不得伪造、PS
  或用其他系统界面代替。
- **禁止模板化炮制**:套通用模板、截图与功能对不上、空泛堆字会被判说明不充分。

## 成功标准

- [ ] 含封面、目录、概述、功能说明(≥5 张截图)、运行环境
- [ ] 每页 ≥30 行(截图页除外),有页眉(名称+版本号)和页码
- [ ] 功能描述与源代码逻辑对应
- [ ] 软件名/版本号与申请表一致
- [ ] `check_manual.py` 已验证实际截图文件、章节、名称和版本号
- [ ] 最终 PDF 已用 `record_artifact.py --kind manual_pdf` 绑定当前说明书 DOCX

**产物**：`03-说明书鉴别材料.pdf`

## 检查点

生成 PDF 后先记录绑定并运行 `check_pdf.py`、`check_artifacts.py`,再让用户审阅内容是否
真实、截图是否清晰；任何文档变动都会使旧 PDF 绑定失效，须重新转换和校验。
