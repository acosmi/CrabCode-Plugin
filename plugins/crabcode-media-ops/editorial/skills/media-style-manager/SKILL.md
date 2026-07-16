---
name: 创作者风格管理
short-description: "合并风格证据、处理冲突并管理版本回滚"
brand-color: "#7B61A8"
icon-small: "./assets/icon.png"
icon-large: "./assets/icon.png"
description: 合并已提交的创作者风格表单与历史作品的抽象观察，展示冲突、生成 profile diff，并在创作者逐项确认后保存版本或回滚。用户要求学习旧文风格、更新账号风格、查看风格历史、处理风格冲突或回滚时使用。
---

# 风格档案管理

先读取 `../../../media-core/PRACTICE.md`、`../../PRACTICE.md` 与 `../../references/style-learning.md`。

1. 只接受同一 brandId 下已 submitted 的表单。
2. 历史作品必须先登记 referenceId；分析只提交权利/允许用途元数据与抽象 features，受保护原文不进入 profile 或写作上下文。
3. 调用 `mediaops.profile.propose`，展示一致项、冲突项和低置信项。
4. 让创作者逐项选择表单值或语料观察；不得静默决定。
5. 所有冲突解决后，由具备 `profile_approver` 角色的可信 principal 调用 `mediaops.profile.confirm` 生成新版本；proposal 的 `profile_editor` 与 confirmer 必须按工具策略分离。
6. 用 `profile.history` 查看历史；回滚也生成新版本并绑定可信 principal。调用参数中的确认人姓名不会替代宿主身份。

“阿拙”仅可作为用户主动选择的 preset，不是插件默认人格。
