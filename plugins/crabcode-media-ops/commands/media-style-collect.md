---
description: 通过快速/完整/增量表单收集创作者风格并经确认生成版本化 profile
argument-hint: "--brand <brandId> [--mode quick|full|incremental]"
allowed-tools: [Read, Glob, Grep, Bash, Task]
---

# /media-style-collect

按 `media-style-intake` → `media-style-manager` 执行。

调用 `mediaops.style.form.template` 提供本地可视表单；未完成时 `save_draft`，恢复时 `get`，完成时 `submit`。历史作品先 `mediaops.reference.register`，只把 referenceId、权利/允许用途元数据和抽象 features 提交 `mediaops.profile.propose`，不传原文。

逐项展示冲突并获得创作者选择，全部解决后才能 `mediaops.profile.confirm`。未经确认不得覆盖正式 profile；不同 brandId 不能互读。历史和回滚使用 `profile.history/rollback`。
