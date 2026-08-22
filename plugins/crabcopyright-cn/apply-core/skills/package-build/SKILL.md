---
name: 软著申请包生成
short-description: 按官方命名规范整理全部材料，并生成逐条自查对照表
description: 把软著各材料按中国版权保护中心命名规范归入一个申请包目录,并生成逐条对照官网规范的材料自查对照表。当用户说"生成软著申请包""整理软著材料成一个文件夹""软著材料打包提交""出一份软著自查对照表",或软著申请管家分派到归档环节时使用。
argument-hint: "[软件全称] [版本号] [各材料所在路径] [输出目录]"
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash(mkdir:*)
  - Bash(cp:*)
  - Bash(ls:*)
  - Bash(python3:*)
---

<!-- capability-route: office-pdf=none(归档工序只按命名规范拷贝前序工序已生成的 PDF 文件,不生成、不合并、不解析 PDF 内容;自查对照表为 markdown) -->

# 软著申请包生成

把已完成的各项材料统一命名、归入严格的 `提交件/` 白名单目录,并产出一份**材料自查对照表**——
可机械判定的项**由确定性脚本产出结果**,不靠模型自述勾选;仅脚本够不着的项
(截图与功能对应、末页自然结尾等)留人工确认并注明。**先读**
`${CRABCODE_PLUGIN_ROOT}/apply-core/GUIDE.md`(用其 §9 红线清单作为对照表的检查项来源)
与 `${CRABCODE_PLUGIN_ROOT}/apply-core/MANIFEST.md`(manifest 结构与脚本一览)。

## 步骤

1. 读该申请的 schema v2 manifest；先运行 `check_ai.py`、`check_rules.py` 和
   `check_all.py`。任何 fail/blocked 时不创建“可提交”目录。
2. 输出目录为申请目录下的 `提交件/`。按命名规范只拷入以下白名单材料:
   - `01-软件著作权登记申请表.pdf`（平台生成后放入）
   - `02-源代码鉴别材料.pdf`
   - `03-说明书鉴别材料.pdf`
   - `04-身份证明文件.pdf`（用户自备）
   - `05-其他材料/`（合作/委托/许可证明等补充件）
   `manifest.json`、`中间态/`、source-line-map、source-selection、source-audit、
   audit-log、本机绝对路径、缓存和测试文件一律不进入 `提交件/`。
3. **运行确定性校验脚本**,以其输出为对照表的机判结果:
   ```
   python3 ${CRABCODE_PLUGIN_ROOT}/scripts/check_all.py \
     --manifest outputs/<申请名>/manifest.json \
     [--compare-with outputs/<其他申请名>/manifest.json]... --json
   ```
   多软著场景必须加 `--compare-with` 做跨申请重叠复核。重叠属于经验 warning 时要在
   对照表解释共享模块；只有确定为重复充数或其他 fail 才阻断。退出码 1 即不得进入
   "可提交"结论。
4. 由脚本创建提交白名单，不由模型自行 cp：
   ```
   python3 ${CRABCODE_PLUGIN_ROOT}/scripts/build_package.py \
     --manifest outputs/<申请名>/manifest.json \
     [--compare-with <其他申请>]...
   ```
   若只有 warn，必须先逐条人工复核，再显式传 `--allow-warn --review-note <复核记录>`；
   AI blocked 不能用该参数覆盖。脚本拒绝覆盖已存在的 `提交件/`。
5. `材料自查对照表.md` 逐条引用脚本结果，并把 `steps.package-build` 原子写回 manifest。

## 材料自查对照表模板

机判项的 ✅/❌ 一律照抄 `check_all.py` 的 pass/fail(warn 记 ⚠️ 附脚本原话),
"脚本依据"列注明来源检查项;人工项不许冒充机判。

```
# 软著申请材料自查对照表 · ${SOFTWARE_NAME} ${VERSION}
> 机判结果由 scripts/check_all.py 于 <时间> 产出(总体结论: PASS/WARN/FAIL),原始 JSON 见附录/终端。

## 一、源代码鉴别材料
- [✅/❌] 总行数与页数达标（脚本依据: source-material,总行数/折算页数原话）
- [⚠️/✅] 无注水迹象:空行/注释/重复占比未超阈值（脚本依据: source-material 告警）
- [✅/❌] 页眉含"软件全称 + 版本号",与 manifest 一致（脚本依据: 一致性校验/人工确认中间态）
- [待人工确认] 右上角连续页码;首页=模块开头,末页=自然结尾

## 二、说明书鉴别材料
- [待人工确认] 含封面/目录/概述/功能说明(配截图)/运行环境;每页 ≥30 行(截图页除外)
- [待人工确认] 功能描述与源代码对应
- [✅/❌] 名称、版本号与 manifest 一致（依据: consistency-check 报告）
- [✅/❌] 功能说明字数 500–1300（脚本依据: func-description）

## 三、申请表与证明文件
- [✅/❌] manifest 必填字段齐全、简称≠全称、版本号写法规范（脚本依据: manifest-fields）
- [✅/❌] 日期逻辑正确:开发完成 ≤ 首次发表 ≤ 申请,企业成立 ≤ 开发完成（脚本依据: date-logic）
- [✅/❌] 多申请无跨申请代码重叠（脚本依据: cross-application-overlap;单申请标"不适用"）
- [待人工确认] 身份证明齐备且与著作权人一致;特殊情形补充材料齐备

## 四、提交前提醒
- 2026 新版申请表:经办人本人签字+身份证号、手抄"未使用 AI"承诺、功能说明 500–1300 字
- 官方普通登记免费
```

## 成功标准

- [ ] 输出目录含全部应有文件(缺项在对照表标 ❌)
- [ ] `提交件/` 只含白名单材料,不含 manifest/line-map/audit-log/本机路径/身份证号文本
- [ ] `check_all.py` 已实际运行,机判项与脚本输出逐条对应,无一项由模型自述代替
- [ ] 对照表涵盖源代码、说明书、申请表三大类的检查项
- [ ] 存在 ❌ 项时在终端醒目提示,不假装完成

## 检查点

若脚本总体结论为 FAIL 或对照表出现 ❌,不要宣称"打包完成即可提交",而应回到
软著申请管家补齐对应材料;WARN 项须向用户逐条说明并由用户决定是否放行。
AI 使用事实与拟签承诺冲突时属于 blocked，不能由用户一句“接受风险”覆盖为通过。
