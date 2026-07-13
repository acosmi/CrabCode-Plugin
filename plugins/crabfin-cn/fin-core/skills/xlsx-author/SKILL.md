---
name: XLSX 生成
short-description: 按金融建模规范生成含输入、校验和公式结构的 XLSX 文件
description: Produce a .xlsx file on disk with finance conventions (inputs tab, blue/black/green color coding, checks tab); engine work and recalculation route to crabcode-office-suite.
license: Apache-2.0. See docs/legal/THIRD_PARTY_NOTICES.md for source attribution.
---

# xlsx-author

Use this skill when a fin-core workflow needs to deliver an Excel workbook as a **file artifact**. 本技能层叠在通用电子表格能力之上:引擎规则、公式校验与交付前重算统一以 `crabcode-office-suite:crabcode-spreadsheets` 为准,这里只补充金融建模侧的约定。

## Output contract

- Write to `./out/<name>.xlsx`. Create `./out/` if it does not exist.
- Return the relative path in your final message so the orchestration layer can collect it.

## How to build the workbook

Write a short Python script and run it with Bash. Use `openpyxl`:

```python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

wb = Workbook()
ws = wb.active; ws.title = "Inputs"
ws["B2"] = "Revenue"; ws["C2"] = 1_250_000_000
ws["C2"].font = Font(color="0000FF")           # blue = hardcoded input
calc = wb.create_sheet("DCF")
calc["C5"] = "=Inputs!C2*(1+Inputs!C3)"        # black = formula
wb.save("./out/model.xlsx")
```

## Conventions (mirror `audit-xls`)

- **Blue / black / green.** Blue = hardcoded input, black = formula, green = link to another sheet/file.
- **No hardcodes in calc cells.** Every calculation cell is a formula; every input lives on an Inputs tab.
- **Named ranges** for any value referenced from a deck or memo.
- **Balance checks.** Include a Checks tab that ties (BS balances, CF ties to cash, etc.) and surfaces TRUE/FALSE.
- **One model per file.** Do not append to an existing workbook unless explicitly asked.

## 产出物路由

- 引擎选型、公式构造规则、零错误校验与交付前重算,统一执行 `crabcode-office-suite:crabcode-spreadsheets` 的流程(headless 写入的公式没有计算值,交付前必须走它的引擎重算步骤);
- 若触发时报 Unknown skill,说明办公套件未安装:引导用户通过 `/plugin` 安装 `crabcode-office-suite` 后重试;安装完成前可先交付公式经静态排错的工作簿,并在交付说明中注明公式值将在 Excel/WPS 打开时计算。

## When NOT to use

If the deliverable is a generic (non-finance) spreadsheet with no modeling conventions involved, invoke `crabcode-office-suite:crabcode-spreadsheets` directly instead of this skill.
