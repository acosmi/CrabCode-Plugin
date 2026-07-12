# 品牌 Profile v2

正式 profile 保存在 `${CRABCODE_PLUGIN_DATA}/profiles/<brandId>/versions/`，`current.json` 只是当前版本副本。每次确认和回滚都生成新版本，不覆盖历史。

核心字段包括 brand_id、profile_version、persona、voice、audience、columns、platforms、banned_words、style、style_refs、compliance、confirmedBy/At 和 sourceFormId。

首次建档或更新应优先通过 `media-style-intake` 表单与 `media-style-manager` 冲突确认流程。`mediaops.profile.save` 只用于具名确认的完整人工导入，也会生成不可变版本。
