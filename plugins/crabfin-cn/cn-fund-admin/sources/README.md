# cn-fund-admin · 素材投放点

> 把中国基金行政与估值的权威素材放进本目录。完整说明见 [`docs/crabfin-cn-素材采集指南.md`](../../../../docs/crabfin-cn-素材采集指南.md)。
> 红线:**不可编造、不可照搬境外会计/估值规则**。

## 放什么 / 放哪里

| 优先级 | 素材 | 子目录 | 命名示例 |
|---|---|---|---|
| **最小起步 L1** | 中基协(AMAC)基金估值指引 | `laws/` | `laws/AMAC基金估值指引.md` |
| **最小起步 L2** | 公允价值估值层级判定标准 | `mappings/` | `mappings/估值层级判定_v1.md` |
| 进阶 L2 | 基金会计核算科目体系 | `mappings/` | `mappings/基金会计科目体系_v1.csv` |
| 进阶 L1 | 基金份额登记与确认规则 | `laws/` | `laws/份额登记确认规则.md` |
| 进阶 L3 | NAV 勾稽底稿模板(脱敏) | `templates/` | `templates/NAV勾稽底稿_脱敏样例.xlsx` |

> 子目录(`laws/ mappings/ templates/`)首次用时直接新建。
> 放好后告诉我"cn-fund-admin 素材已就位",我据此重写技能并跑校验。

**覆盖技能**:accrual-schedule / break-trace / gl-recon / nav-tieout / roll-forward / variance-commentary
