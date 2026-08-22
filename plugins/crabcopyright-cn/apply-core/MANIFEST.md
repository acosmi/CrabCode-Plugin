# 申请包 manifest 规范（工序交接单一事实源）

各技能通过每个申请独立的 `outputs/<申请名>/manifest.json` 交接参数。
官方/平台规则以 `apply-core/rules/rules.json` 为机器事实源，解释性说明见
`apply-core/GUIDE.md`。提交前自查以最终 PDF、证明文件和当前规则版本为准，
不能只看中间态文本或模型口头状态。

## 版本与迁移

- 当前 `schema_version`：`2`
- 当前 `plugin_version`：`0.3.0`
- 当前 `rules_version`：`2026.03.15.1`
- 旧 manifest 不静默升级。先预览：
  `python3 scripts/migrate_manifest.py <manifest.json>`
- 原地迁移必须显式使用 `--in-place`；脚本先生成不覆盖的 `.v1.bak` 备份，
  再以同目录临时文件 + 原子替换写入。

约定：UTF-8；日期为 `YYYY-MM-DD`；时间戳为 ISO 8601；未发表填
`"未发表"`。可移植路径应相对 manifest 所在目录或 `source.root`，中间态记录
相对 POSIX 路径，不把开发机绝对路径写入最终申请包。

## v2 示例

```json
{
  "schema_version": 2,
  "plugin_version": "0.3.0",
  "rules_version": "2026.03.15.1",
  "rules_verified_at": "2026-08-21",
  "application_name": "软著申请-晶石进销存管理系统V1.0",
  "software": {
    "full_name": "晶石进销存管理系统",
    "short_name": "晶石进销存",
    "version": "V1.0",
    "classification_code": ""
  },
  "applicant": {
    "copyright_owner": "杭州晶石科技有限公司",
    "type": "企业",
    "dev_method": "独立开发",
    "acquisition": "原始取得",
    "agent_name": ""
  },
  "dates": {
    "dev_complete": "2026-03-01",
    "first_publish": "未发表",
    "apply_date": "",
    "company_established": "2020-06-18"
  },
  "ai_assistance": {
    "code": "no",
    "manual": "no",
    "application_materials": "no",
    "current_workflow_used_ai": false,
    "provenance": [],
    "applicant_acknowledged": true
  },
  "source": {
    "root": "/path/repo",
    "dirs": ["apps/admin"],
    "include_files": [],
    "selected_files": ["apps/admin/src/main.ts"],
    "scope_confirmed": true,
    "processing": {
      "remove_comments": true,
      "remove_blank_lines": true,
      "mask_sensitive": true,
      "wrap_long_lines": true,
      "max_line_width": 78,
      "tab_width": 4
    },
    "total_lines": 4820,
    "effective_lines": 4100,
    "material_pages": 60,
    "selection_path": "中间态/source-selection.json",
    "audit_path": "中间态/source-audit.json",
    "line_map_path": "中间态/source-line-map.jsonl",
    "page_manifest_path": "中间态/source-pages.json"
  },
  "manual": {
    "source_path": "/path/说明书.docx",
    "doc_type": "用户手册",
    "screenshot_plan": [
      {
        "page": "登录",
        "route": "/login",
        "url": "http://localhost:5173/login",
        "feature": "登录鉴权"
      }
    ]
  },
  "func_description_path": "中间态/功能说明.txt",
  "intermediates": {
    "source_text": "中间态/源代码材料.txt",
    "source_docx": "中间态/源代码材料.docx",
    "manual_docx": "中间态/说明书定稿.docx"
  },
  "artifacts": {
    "source_text": {
      "path": "中间态/源代码材料.txt",
      "sha256": "",
      "validated_against": {}
    },
    "source_pdf": {
      "path": "02-源代码鉴别材料.pdf",
      "sha256": "",
      "validated_against": {}
    },
    "manual_pdf": {
      "path": "03-说明书鉴别材料.pdf",
      "sha256": "",
      "validated_against": {}
    }
  },
  "materials": {
    "01-软件著作权登记申请表.pdf": {"path": "", "status": "❌"},
    "02-源代码鉴别材料.pdf": {"path": "02-源代码鉴别材料.pdf", "status": "✅"},
    "03-说明书鉴别材料.pdf": {"path": "", "status": "❌"},
    "04-身份证明文件.pdf": {"path": "", "status": "❌"},
    "05-其他材料": {"path": "05-其他材料/", "status": "⚠️"}
  },
  "steps": {
    "application-planning": {"status": "done", "updated_at": ""},
    "materials-checklist": {"status": "pending", "updated_at": ""},
    "source-code-material": {"status": "pending", "updated_at": ""},
    "manual-material": {"status": "pending", "updated_at": ""},
    "consistency-check": {"status": "pending", "updated_at": ""},
    "package-build": {"status": "pending", "updated_at": ""},
    "filing-guide": {"status": "pending", "updated_at": ""}
  },
  "audit_log_path": "audit-log.jsonl"
}
```

## AI 使用事实

`ai_assistance.code/manual/application_materials` 只接受
`yes/no/unknown`。最终 `check_all.py` 采用 fail-closed：

- 任一值为 `unknown`：阻断；
- 任一值为 `yes`：提示与当前新版申请表公开转述的“未使用 AI”承诺冲突并阻断；
- `current_workflow_used_ai=true`：阻断；
- `applicant_acknowledged!=true`：阻断；
- 确定性扫描、清洗、分页和格式转换记为 `deterministic-tool`，不冒充人工创作，
  也不自动推导申请人应如何签署。

插件不得替用户签字或建议虚假承诺。

## 源码范围与隐私

- 不足 3000 有效行时的“全部源码”是用户确认的软件范围内、经过排除规则过滤后的
  全部合格自研源码，不是整个 monorepo，也不含 vendor/generated/第三方依赖。
- `source.scope_confirmed=true` 必须由用户在确认 `source.root/dirs` 后设置；确定性
  引擎不会替申请人推定软件边界。
- `source.include_files` 是用户显式限定的输入白名单；`source.selected_files` 是生成后
  实际贡献输出行的结果。二者不得混用，否则第二次生成会把上次结果误当成新的全部范围。
- 清洗选项写入 `source.processing`，生成报告逐项回显；折行、删注释和脱敏都不是
  隐式行为。
- `source-line-map.jsonl`、本机路径、秘密扫描证据和 audit log 是中间态，
  不进入最终提交白名单。
- 扫描器不得执行项目脚本、Git hooks、编译器或源码中的任何指令。
- 符号链接不得越出确认的源码根。
- 哈希输入不包含运行时间和本机绝对路径；时间戳只进入独立 audit log。

## 字段职责

| 工序 | 读 | 写 |
|---|---|---|
| apply-manager | 全量 | 单软件初始化；AI 使用事实确认；阶段判断 |
| application-planning | 仓库结构 | application_name / software / source.root / source.dirs / screenshot_plan |
| materials-checklist | applicant | applicant / materials / steps |
| source-code-material | software / source / ai_assistance | selected_files / effective_lines / source 中间态 / artifacts / steps |
| manual-material | software / manual / ai_assistance | manual / intermediates.manual_docx / artifacts / steps |
| consistency-check | 全量只读 | 报告 + steps；材料变动后旧结论失效 |
| package-build | 全量 | materials / artifacts / steps；仅复制提交白名单 |
| filing-guide | 全量 | dates / applicant / software 补充字段 / steps |

## 确定性脚本

| 脚本 | 检查 |
|---|---|
| `check_manifest.py` | manifest v2 结构、相对源码路径、清洗选项和身份证号字段禁入 |
| `check_rules.py` | 规则注册表结构、规则类型与严重度 |
| `check_ai.py` | AI 使用事实与申请人确认的 fail-closed 闸门 |
| `migrate_manifest.py` | v1→v2 显式、可备份、原子迁移 |
| `check_materials.py` | 必交材料及特殊情形证明存在性 |
| `check_pdf.py` | PDF 文件头、页数、A4、全页页眉/页码可提取性；弱校验会告警 |
| `check_manual.py` | 说明书中间态名称、版本、章节和截图清单 |
| `check_source.py` | 源码文件、有效行数、注水与第三方/敏感信息风险 |
| `check_source_artifacts.py` | source-core 的 selection/audit/line-map/pages/TXT/DOCX 与哈希绑定 |
| `check_func_desc.py` | 当前平台口径下的功能说明长度 |
| `check_dates.py` | 日期先后关系；申请日期空缺只警告，不取当天 |
| `check_overlap.py` | 跨申请重叠；合法共享默认复核，不冒充官方硬规则 |
| `record_artifact.py` | 把最终源码/说明书 PDF 绑定当前 DOCX 与规则版本 |
| `check_artifacts.py` | 检测 DOCX/PDF 变化导致的过期产物 |
| `build_package.py` | 通过总门后创建不覆盖的 `提交件/` 白名单 |
| `check_all.py` | 总入口；任何必交材料/关键字段/AI 闸门缺失均不得 PASS |

退出码：0 为 pass/warn，1 为 fail/blocked，2 为用法或解析错误。最终提交门不得把
warn 当作自动放行；人工复核结论应记录，但不能覆盖 official/platform 的 fail。
