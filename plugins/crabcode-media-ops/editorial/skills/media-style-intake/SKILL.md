---
name: 创作者风格采集
short-description: "通过结构化表单采集并更新创作者风格"
brand-color: "#D96C3F"
icon-small: "./assets/icon.png"
icon-large: "./assets/icon.png"
description: 通过快速、完整或增量创作者风格采集表单建立和更新账号风格。用户要收集创作者类型、首次建档、没有历史文章也要定风格、填写风格问卷或保存表单草稿时必须使用；表单只提交草案，不能直接覆盖正式 profile。
---

# 创作者风格采集

先读取 `../../../media-core/PRACTICE.md`、`../../PRACTICE.md` 与 `../../references/creator-style-form.md`。

1. 选择模式：快速建档、完整建档、增量更新。
2. 调用 `mediaops.style.form.template` 生成非技术用户可打开的本地表单预览。
3. 逐步收集定位、创作者类型、读者、表达维度、结构、语言禁区、真实性边界、样本权利、平台差异与存储同意。
4. 未完成时调用 `save_draft`；恢复时先 `get`，不得丢失已填字段。
5. 完成后调用 `submit`。提交状态仍是待确认，不是正式 profile。

不收集身份证号、住址等无关敏感信息；不把外部样本全文写入表单。
