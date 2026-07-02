# 申请包 manifest 规范（工序交接单一事实源）

各技能之间的参数交接**不靠口头复述**,而是读写每个申请独立的
`outputs/<申请名>/manifest.json`(`<申请名>` = `软著申请-<软件全称><版本号>`)。
官方规范判断仍以 `GUIDE.md` 为准;本文件只定义交接数据的结构与读写职责。
确定性校验脚本(`scripts/check_all.py` 等)直接消费这份 manifest。

约定:UTF-8 编码;路径字段用绝对路径,或相对 manifest 所在目录的相对路径;
时间戳用 ISO 8601;日期用 `YYYY-MM-DD`;未发表时 `first_publish` 填 `"未发表"`。

## 结构与字段

```json
{
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
  "source": {
    "dirs": ["/path/repo/apps/admin"],
    "selected_files": ["/path/repo/apps/admin/src/main.ts"],
    "total_lines": 4820,
    "material_pages": 60
  },
  "manual": {
    "source_path": "/path/说明书.docx",
    "doc_type": "用户手册",
    "screenshot_plan": [
      {"page": "登录", "route": "/login", "url": "http://localhost:5173/login", "feature": "登录鉴权"}
    ]
  },
  "func_description_path": "功能说明.txt",
  "intermediates": {
    "source_text": "中间态/源代码材料.txt",
    "manual_docx": "中间态/说明书定稿.docx"
  },
  "materials": {
    "01-软件著作权登记申请表.pdf": {"path": "", "status": "❌"},
    "02-源代码鉴别材料.pdf": {"path": "02-源代码鉴别材料.pdf", "status": "✅"},
    "03-说明书鉴别材料.pdf": {"path": "", "status": "❌"},
    "04-身份证明文件.pdf": {"path": "", "status": "❌"},
    "05-其他材料": {"path": "05-其他材料/", "status": "⚠️"}
  },
  "steps": {
    "application-planning": {"status": "done", "updated_at": "2026-07-01T10:00:00+08:00"},
    "materials-checklist": {"status": "pending", "updated_at": ""},
    "source-code-material": {"status": "pending", "updated_at": ""},
    "manual-material": {"status": "pending", "updated_at": ""},
    "consistency-check": {"status": "pending", "updated_at": ""},
    "package-build": {"status": "pending", "updated_at": ""},
    "filing-guide": {"status": "pending", "updated_at": ""}
  }
}
```

- `applicant.type`:个人 / 企业 / 事业单位;`dev_method`:独立/合作/委托/下达任务/职务/继受取得/二次开发;
  `acquisition`:原始取得 / 继受取得。**不得**写入身份证号等隐私(GUIDE.md §9 红线)。
- `materials.*.status`:✅ 已有 / ❌ 缺失 / ⚠️ 待确认;`steps.*.status`:`pending` / `in_progress` / `done` / `blocked`。
- `intermediates` 存生成 PDF 之前的中间态文件(整理后的源码文本、定稿 docx、功能说明 txt)——
  一致性校验对这些中间态而非最终 PDF 做机械比对。

## 各工序读写职责

| 工序 | 读 | 写 |
|------|----|----|
| apply-manager | 全量(判断阶段、汇报进度) | 单软件场景初始化 manifest;fan-out 场景把子代理回传草稿核对后落盘 |
| application-planning | — | 为每个申请初始化 manifest(application_name / software / source.dirs / manual.screenshot_plan) |
| materials-checklist | applicant | applicant.type / dev_method / acquisition,materials 各项状态,steps |
| source-code-material | software、source.dirs | source.selected_files / total_lines / material_pages,intermediates.source_text,materials["02-…"],steps |
| manual-material | software、manual | manual.source_path / doc_type,intermediates.manual_docx,materials["03-…"],steps |
| consistency-check | 全量(只读比对) | steps(校验结论);报告文件写入 outputs/<申请名>/ |
| package-build | 全量 | materials 各项 path/status,steps |
| filing-guide | 全量 | dates、applicant、software.short_name / classification_code 等用户确认值,steps |

## 校验脚本(scripts/,python3 纯标准库)

| 脚本 | 检查 | 用法 |
|------|------|------|
| `check_source.py` | 行数统计、页数折算(每页 50 行/60 页)、注水启发式(空行/注释/重复占比,经验阈值) | `python3 check_source.py <文件或目录>... [--json]` |
| `check_func_desc.py` | 功能说明字数(500–1300,GUIDE §8 口径) | `python3 check_func_desc.py <文本文件> [--json]` |
| `check_dates.py` | 开发完成/首次发表/申请/企业成立日期先后关系 | `python3 check_dates.py --manifest <manifest.json> [--json]` |
| `check_overlap.py` | 跨申请相同文件与高重复内容 | `python3 check_overlap.py <申请A路径>... --vs <申请B路径>... [--json]` |
| `check_all.py` | 总入口:字段完整性+以上全部 | `python3 check_all.py --manifest <manifest.json> [--compare-with <其他manifest或目录>]... [--json]` |

退出码:0 通过(含 warn)、1 有 fail、2 用法/解析错误。warn 是经验阈值告警,须人工复核后决定放行与否。
