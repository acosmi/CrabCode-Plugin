---
name: PPTX 生成
short-description: 按金融演示规范生成可追溯到模型数据的 PPTX 文件
description: Produce a .pptx file on disk with finance deck conventions (one idea per slide, numbers trace to the model, firm template support); engine work routes to crabcode-office-suite.
license: Apache-2.0. See docs/legal/THIRD_PARTY_NOTICES.md for source attribution.
---

<!-- capability-route: office-spreadsheets=none(model.xlsx 仅作为数字溯源脚注的来源文件名出现,表格由建模侧技能生成,本技能只产出 .pptx) -->

# pptx-author

Use this skill when a fin-core workflow needs to deliver a PowerPoint deck as a **file artifact**. 本技能层叠在通用演示文稿能力之上:引擎与通用制作规范统一以 `crabcode-office-suite:crabcode-presentations` 为准,这里只补充金融路演侧的约定。

## Output contract

- Write to `./out/<name>.pptx`. Create `./out/` if it does not exist.
- Return the relative path in your final message so the orchestration layer can collect it.

## How to build the deck

Write a short Python script and run it with Bash. Use `python-pptx`:

```python
from pptx import Presentation
from pptx.util import Inches, Pt

prs = Presentation("./templates/firm-template.pptx")  # if a template is provided
# or: prs = Presentation()

slide = prs.slides.add_slide(prs.slide_layouts[5])    # title-only
slide.shapes.title.text = "Valuation Summary"
# ... add tables / charts / text boxes ...

prs.save("./out/pitch-<target>.pptx")
```

## Conventions (mirror the live-Office `pitch-deck` skill)

- **One idea per slide.** Title states the takeaway; body supports it.
- **Every number traces to the model.** If a figure comes from `./out/model.xlsx`, footnote the sheet and cell.
- **Use the firm template** when one is mounted at `./templates/`; otherwise default layouts.
- **Charts**: prefer embedding a PNG rendered from the model over native pptx charts when fidelity matters.
- **No external sends.** This skill writes a file; it never emails or uploads.

## 产出物路由

- 引擎选型与通用 .pptx 制作规范,统一执行 `crabcode-office-suite:crabcode-presentations` 的流程;
- 若触发时报 Unknown skill,说明办公套件未安装:引导用户通过 `/plugin` 安装 `crabcode-office-suite` 后重试;安装完成前先以 markdown 大纲呈现内容供用户确认。

## When NOT to use

If the deliverable is a generic (non-finance) deck with no roadshow conventions involved, invoke `crabcode-office-suite:crabcode-presentations` directly instead of this skill.
