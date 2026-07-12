---
description: 通过快速/完整/增量表单收集创作者风格并经确认生成版本化 profile
argument-hint: --brand <brandId> [--mode quick|full|incremental]
allowed-tools: [Read, Glob, Grep, Bash, Task]
---

# /media-style-collect

按 `media-style-intake` → `media-style-manager` 执行。

调用 `mediaops.style.form.template` 提供本地可视表单；未完成时 `save_draft`，恢复时 `get`，完成时 `submit`。如有历史作品，只提交抽象 features 和权利元数据给 `mediaops.profile.propose`。

逐项展示冲突并获得创作者选择，全部解决后才能 `mediaops.profile.confirm`。未经确认不得覆盖正式 profile；不同 brandId 不能互读。历史和回滚使用 `profile.history/rollback`。
