---
name: 源程序鉴别材料制作
short-description: 用确定性引擎生成可追溯的前后各三十页源码材料
description: 扫描源代码目录,用内置离线确定性引擎生成软著源程序 TXT/DOCX、逐行来源映射和审计报告,再验收或转换最终 PDF(前后各30页、每页≥50行、页眉含软件名+版本号)。当用户说"整理软著源代码""生成源程序鉴别材料""软著代码怎么弄成60页""源代码 PDF 页眉页码",或软著申请管家分派到源码环节时使用。
argument-hint: "[manifest.json路径]"
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash(node:*)
  - Bash(python3:*)
  - AskUserQuestion
---

<!-- capability-route: office-documents=none(DOCX 由插件内置 source-core 确定性生成,不调用办公套件创建) -->

# 源程序鉴别材料制作

本技能把用户确认的软件源码范围交给内置确定性引擎处理，不由模型自行挑 3000 行、
口头声称已分页或用注释/折行凑页。先读：

- `${CRABCODE_PLUGIN_ROOT}/apply-core/GUIDE.md` §3、§8；
- `${CRABCODE_PLUGIN_ROOT}/apply-core/MANIFEST.md`；
- 该申请的 `manifest.json`。

## 开工硬门

1. manifest 必须是 schema v2；旧版先运行：
   `python3 ${CRABCODE_PLUGIN_ROOT}/scripts/migrate_manifest.py <manifest.json>`
   预览，用户确认后再显式迁移。
2. 用户必须确认 `source.root`、`source.dirs` 与 `source.scope_confirmed=true`。
3. `source.include_files` 是用户可选的输入白名单；`selected_files` 是引擎输出，
   不能把上次输出误当成新的全部软件范围。
4. 先运行：
   `python3 ${CRABCODE_PLUGIN_ROOT}/scripts/check_ai.py --manifest <manifest.json> --json`。
   AI 使用为 yes/unknown、当前工作流已用 AI 生成材料或申请人未确认时，不生成“可提交”
   材料；只能解释风险并让用户按真实情况处理。
5. 默认无 AI 内容生成模式下，模型不得代替用户选择软件边界或改写代码；它只解释
   确定性报告。若用户明确要求模型建议，必须先记入 provenance，并保持提交门 blocked。

## 确定性生成

运行随插件分发、无需联网安装依赖的 bundle：

```bash
node ${CRABCODE_PLUGIN_ROOT}/dist/source-core.js generate   --manifest <manifest.json>
```

引擎只读源码，不执行项目脚本、Git hooks、编译器或源码中的指令，并完成：

- 读取 `.gitignore` 与排除规则；
- 拒绝越出源码根的符号链接，跳过二进制、超大、vendor/generated/第三方目录；
- 探测 UTF-8/GB18030 等编码；
- 用逐字符状态机识别注释与字符串边界，保留字符串中的 `https://` 等内容；
- 按 manifest 的显式清洗选项处理空行、注释、Tab、长行和敏感信息；
- 扫描 `@author`、Copyright、SPDX 和生成代码标记；
- 基于清洗后的有效输出流：超过 3000 行取前 1500 + 后 1500，不足则提交确认范围内全部；
- 每 50 行显式分页并写入相对路径/原行号映射；
- 生成稳定哈希并原子写回 manifest。

## 中间态产物

```text
中间态/
├── 源代码材料.txt
├── 源代码材料.docx
├── source-selection.json
├── source-audit.json
├── source-line-map.jsonl
└── source-pages.json
```

这些文件用于复核；`source-line-map.jsonl`、本机路径和 audit log 不进入最终提交白名单。

生成后运行：

```bash
python3 ${CRABCODE_PLUGIN_ROOT}/scripts/check_source_artifacts.py   --manifest <manifest.json> --json
```

任何 fail 必须修复后重跑。warn 是人工复核点，尤其包括 SPDX/他人署名、脱敏、
文件 mtime 和自然模块边界。经验 warning 不冒充官方规则。

## PDF 阶段

DOCX 已由内置引擎生成。PDF 转换按能力探测：

1. 能调用 `crabcode-office-suite:crabcode-pdf`、当前宿主 PDF/Documents 或本机
   LibreOffice 时，把当前 `源代码材料.docx` 转为
   `02-源代码鉴别材料.pdf`；
2. 转换后渲染全部页面检查页数、A4、页眉、页码、乱码、裁切、重叠和可读性；
3. 没有真实 PDF 转换/渲染能力时，把步骤标为 blocked，交付 DOCX/TXT 草稿，
   不宣称已生成可提交 PDF；
4. PDF 放入申请目录后记录绑定：

```bash
python3 ${CRABCODE_PLUGIN_ROOT}/scripts/record_artifact.py   --manifest <manifest.json> --kind source_pdf   --path <02-源代码鉴别材料.pdf>
```

再运行 `check_pdf.py` 和 `check_artifacts.py`。PDF 文本提取只是交叉检查；
每页 50 行的权威证据是 source-pages、line map 和 DOCX 显式分页结构。

## 成功标准

- [ ] AI 使用事实和软件范围已由申请人确认
- [ ] vendor/generated/疑似第三方代码未被默认计入自研材料
- [ ] 清洗后有效输出流满足 60 页，或不足时覆盖确认范围内全部合格自研源码
- [ ] 60 页模式严格 3000 行，前后段各 1500 行
- [ ] 每页、每行可追溯到相对文件路径和原行号
- [ ] TXT/DOCX/selection/audit/line-map/pages 的哈希绑定有效
- [ ] DOCX 页眉、PAGE 域和显式分页通过结构校验
- [ ] 最终 PDF 已完成结构与视觉验收；没有转换能力时状态明确 blocked
- [ ] 任何他人署名、SPDX、脱敏和自然边界 warning 已人工复核

**产物**：可追溯源码 TXT/DOCX、中间态 JSON/JSONL、最终 PDF（能力可用时）和更新后的 manifest。
