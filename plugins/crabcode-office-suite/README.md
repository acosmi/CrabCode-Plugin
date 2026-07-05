# CrabCode 办公套件

CrabCode 办公文档能力插件:创建与编辑电子表格(.xlsx/.csv)、Word 文档(.docx)、演示文稿(.pptx)与 PDF,附带 TypeScript 运行时辅助层。**本插件是插件库"办公文档产出"能力域的统一供给方**,垂直领域插件(法律、金融、媒体等)需要交付 Word/Excel/PPT/PDF 时按全限定名路由到本插件。

## 安装

在 CrabCode 插件市场中添加 `crabcode-office-suite`,或通过 `/plugin` 安装。

## 技能(按需自动触发)

| 技能 | 全限定名(跨插件引用用) | 说明 |
|---|---|---|
| `crabcode-spreadsheets` | `crabcode-office-suite:crabcode-spreadsheets` | 创建、读取、编辑、修复 .xlsx/.xlsm/.csv/.tsv:公式、格式、图表 |
| `crabcode-documents` | `crabcode-office-suite:crabcode-documents` | 创建、读取、编辑、重构 Word 文档(.docx) |
| `crabcode-presentations` | `crabcode-office-suite:crabcode-presentations` | 创建幻灯片/路演材料,读取与解析 .pptx |
| `crabcode-pdf` | `crabcode-office-suite:crabcode-pdf` | PDF 读取抽取、合并拆分、水印、表单填写、加解密 |

## 跨插件路由声明(供其他插件引用)

- 其他插件的 SKILL.md 在需要文档产出时,应按 `docs/capability-routing.md`(仓库根)登记的全限定名引用上表技能;
- 若本插件未安装,引用方应引导用户通过 `/plugin` 安装 `crabcode-office-suite` 后重试(直接触发未安装插件的技能会得到 Unknown skill 错误)。

## 使用入口

直接描述文档任务(如"把这份分析导出成 Word""生成一份季度报表 xlsx"),CrabCode 会自动匹配技能。
