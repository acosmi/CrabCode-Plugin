---
name: consistency-check
description: 逐字核对软著各材料(申请表、源代码鉴别材料页眉、说明书封面/页眉)中的软件全称、版本号、开发完成/首次发表日期是否完全一致,并输出比对报告。当用户说"检查软著材料一致性""核对软著名称版本号""软著材料对不对得上""软著提交前自查",或软著申请管家在有材料更新后要求校验时使用。一致性不达标是软著最高频驳回原因,任何材料更新后都应重跑本技能。
argument-hint: "[申请包目录或各材料路径]"
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash(python3:*)
---

<!-- capability-route: office-pdf=none(成品 PDF 明确不在比对范围——PDF 无法 Grep,比对对象是生成 PDF 之前的中间态材料,本技能不产出也不解析 PDF) -->

# 软著材料一致性校验

软著登记最高频的驳回原因就是**名称/版本号在三处对不上**。本技能对 **manifest ＋
生成 PDF 之前的中间态文件**做机械逐字比对,把不一致项高亮出来——最终 PDF 无法
Grep,所以比对对象是 manifest 字段与 `intermediates` 里的中间材料,PDF 必须由这些
中间态生成,两者一致即传递到成品。**先读**
`${CRABCODE_PLUGIN_ROOT}/apply-core/GUIDE.md` §5、§6(名称版本号规范与日期逻辑)与
`${CRABCODE_PLUGIN_ROOT}/apply-core/MANIFEST.md`(manifest 结构)。

## 校验矩阵

| 检查项 | 比对来源(manifest ⇔ 中间态) |
|--------|----------|
| 软件全称 | manifest `software.full_name` ⇔ 源码材料文本页眉行 ⇔ 说明书定稿封面/页眉 ⇔ 功能说明 |
| 版本号(含有无"V") | manifest `software.version` ⇔ 源码材料文本页眉行 ⇔ 说明书定稿封面/页眉 |
| 开发完成日期 | manifest `dates.dev_complete`(申请表按它填,如实) |
| 首次发表日期 | manifest `dates.first_publish`(须 ≥ 开发完成日期;未发表则为"未发表") |
| 申请人名称 | manifest `applicant.copyright_owner` ⇔ 身份证明(企业须=营业执照全称,后者由用户口头确认) |

**额外逻辑校验**：
- 首次发表日期 ≥ 开发完成日期(未发表则不应有发表日期)。
- 企业申请:开发完成日期不早于企业成立日期。
- 版本号写法全材料统一(不能一处 `V1.0`、一处 `1.0`)。

## 执行

1. 读该申请的 `outputs/<申请名>/manifest.json`,以其字段为基准值。
2. 用 Grep/Read 从 `intermediates.source_text`、`intermediates.manual_docx`
   (或其抽取文本)、`func_description_path` 提取名称/版本号/日期,与 manifest
   逐字比对(注意大小写、空格、全半角)。中间态文件缺失时标 ⚠️ 并要求补齐,
   不得拿"PDF 里大概是对的"充数。
3. 日期与字段规范交给确定性脚本,不凭目测:
   `python3 ${CRABCODE_PLUGIN_ROOT}/scripts/check_dates.py --manifest <manifest.json> --json`
   (需要整体核验时可直接跑 `scripts/check_all.py --manifest <manifest.json> --json`)。
4. 报告写入 `outputs/<申请名>/一致性校验报告.md`,并把结论写回
   `steps.consistency-check`(全部一致为 `done`,有不一致为 `blocked`)。

## 输出：校验报告

```
## 一致性校验报告 · ${SOFTWARE_NAME} ${VERSION}
| 检查项 | manifest | 源码材料(中间态) | 说明书(中间态) | 结果 |
|--------|--------|----------|--------|------|
| 软件全称 | ... | ... | ... | ✅/❌ |
| 版本号   | ... | ... | ... | ✅/❌ |
| 开发完成日期 | ... | — | — | ✅ |
| 首次发表日期 | ... | — | — | ✅(≥开发完成) |

结论：全部一致 ✅ / 发现 N 处不一致 ❌（逐条列出并给修正建议）
```

## 成功标准

- [ ] 名称、版本号在三处完全一致
- [ ] 日期逻辑正确(开发完成 ≤ 首次发表)
- [ ] 报告写入申请包目录并在终端输出

## 检查点

发现任何不一致,立即暂停并醒目提示用户修正对应材料,修正后重跑本技能。

## 产出物路由

- 本技能的报告以 markdown 交付,不产出 Office 文件;但当 `intermediates.manual_docx`
  只有 .docx 定稿、没有现成抽取文本时,调用 `crabcode-office-suite:crabcode-documents`
  读取定稿的封面/页眉文本再做比对,不得跳过该检查项充数。
- 若触发时报 Unknown skill,说明办公套件未安装:引导用户通过 `/plugin` 安装
  `crabcode-office-suite` 后重试;安装完成前把该检查项标 ⚠️ 待补,不得凭猜测判定一致。
