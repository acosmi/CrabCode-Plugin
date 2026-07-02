---
name: source-code-material
description: 扫描源代码目录,按中国版权保护中心规范生成软著源程序鉴别材料 PDF(前30+后30页、每页≥50行、页眉含软件名+版本号、右上角连续页码),并引导用 crabcode-office-suite 办公套件完成 PDF 排版。当用户说"整理软著源代码""生成源程序鉴别材料""软著代码怎么弄成60页""源代码 PDF 页眉页码",或软著申请管家分派到源码环节时使用。
argument-hint: "[源代码目录] [软件全称] [版本号]"
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Task
  - Bash(python3:*)
  - AskUserQuestion
---

# 源程序鉴别材料制作

从 `$SOURCE_CODE_DIR` 提取核心源代码,排成符合规范的 60 页 PDF。**先读**
`${CRABCODE_PLUGIN_ROOT}/apply-core/GUIDE.md` §3——页数、行数、页眉、页码、注水红线
以它为准,本技能只讲怎么做。

## 步骤

0. 读该申请的 `outputs/<申请名>/manifest.json`(结构见
   `${CRABCODE_PLUGIN_ROOT}/apply-core/MANIFEST.md`)取软件全称/版本号与
   `source.dirs`,不靠口头交接;manifest 缺字段才追问。
1. 用 Glob 扫描代码目录,**排除**无关目录/文件:`node_modules`、`vendor`、`.git`、
   `target`、`dist`、`build`、`__pycache__`、`*.min.js`、`*.bundle.js`、`*.map`、
   大型测试夹具、生成代码。仓库较大时,用 Task 派发 **sc-material-collector**
   子代理(只读)完成扫描、挑选与统计,回传候选清单后由本工序核对采用。
2. **优先**选取 `src`/`lib`/`app`/`core` 下的主力语言核心业务文件。
3. 取前 30 页 ＋ 后 30 页(每页 ≥50 行);第 1 页为程序/模块**开头**,第 60 页为自然**结尾**。
   **总行数不足 3000 行**时,提交全部代码并在开头标注"本软件共 XX 行"。
4. 用脚本核验行数/页数与注水占比,不凭目测:
   `python3 ${CRABCODE_PLUGIN_ROOT}/scripts/check_source.py <入选文件>... --json`;
   有 warn 先调整选文件再复跑——"文件级注水疑点"会点名具体文件,优先剔除它。
5. 每页加页眉 `${SOFTWARE_NAME} ${VERSION}`,右上角连续页码(`-1-`…`-60-`)。
6. 确保末页呈现自然的程序结尾(函数/类闭合、`}`、`return`),不在语句中间截断。
7. 把结果写回 manifest:`source.selected_files` / `total_lines` / `material_pages`、
   `intermediates.source_text`(排版前的中间态文本路径)、`materials["02-源代码鉴别材料.pdf"]`,
   `steps.source-code-material` 置 `done`。

## 用 crabcode-office-suite 办公套件排版 PDF

源码转 PDF、批量加页眉页码、合并成单一文件,交给办公套件处理——不要自己硬拼
(**点名对应办公套件技能**,它们各有触发词会在相应场景被唤起):

- **转 PDF / 加页眉页码 / 合并**:用 `crabcode-pdf` 技能。把整理好的代码文本
  (含每页页眉与页码规则)交给它生成 `02-源代码鉴别材料.pdf`。
- 若需要先把代码灌进带页眉页脚的 Word 版式再导出,可先用 `crabcode-documents`
  生成 .docx,再用 `crabcode-pdf` 转 PDF。

选择原则:纯文本代码直接走 crabcode-pdf 最省事;需要精细版式(封面、样式)才绕 Word。

## 规则

- **禁止注水**:不用空行、纯注释、重复模板凑 50 行/60 页。以有效代码为主。
- 字体等宽、字号 ≤ 小四,保证每页 ≥50 行。
- 有敏感信息(真实姓名、地址、密钥)提醒用户遮掩。
- 涉密核心代码可走"例外交存"(GUIDE.md §3),提示用户咨询登记机构。

## 成功标准

- [ ] PDF 共 60 页（或 <60 页已标注总行数不足并交全部）
- [ ] 每页含页眉"软件名+版本号"且与申请表一致
- [ ] 每页右上角连续页码
- [ ] 首页=模块开头,末页=自然结尾,无注水
- [ ] `scripts/check_source.py` 无 fail,warn 已人工复核;结果已写回 manifest

**产物**：`02-源代码鉴别材料.pdf` ＋ manifest 的 `source` 字段更新
