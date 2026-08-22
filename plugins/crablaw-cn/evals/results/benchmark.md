# Skill Benchmark: crablaw-cn

**Model**: <model-name>
**Date**: 2026-08-22T05:14:41Z
**Evals**: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 (1 run per configuration)

## Summary

| Metric | With Skill | Without Skill | Delta |
|--------|------------|---------------|-------|
| Pass Rate | 100% ± 0% | 88% ± 32% | +0.12 |
| Time | 0.0s ± 0.0s | 0.0s ± 0.0s | +0.0s |
| Output chars proxy | 4200 ± 313 | 6955 ± 270 | -2755 |
## Analyst Notes

- 全套共有 36 条断言：with_skill 为 36/36，without_skill 为 31/36；其中 31 条（86.1%）在两种配置下都通过，没有两边都失败或 with_skill 反而失败的断言，因此当前大多数断言不区分两种配置。
- 全部 5 个增量通过都集中在 eval-1 和 eval-2：eval-2 贡献 4 个（80%），eval-1 贡献 1 个（20%）；宏平均提升 0.125 也正好由 eval-2 的 +1.00 和 eval-1 的 +0.25 分摊到 10 个 eval 形成，eval-3 至 eval-10 均为两边满分持平。
- eval-2 是唯一从 0/4 提升到 4/4 的主增益项，四条断言检查双链编排、document/fact/issue/claim-evidence 产物名称、ID 关联及 Writer 前 reviewer/validator；grading 同时明确附件合同和催款邮件没有打开，所以该结果衡量的是流程结构描述，不是实体深度分析、事实准确性或引用可追溯性。
- eval-1 的唯一区分项是 canonical crablaw-cn 调用名；Matter Gate、跨数据/AI/合同/产品或营销覆盖和不直接批准上线均由基线通过。eval-10 则两边都得 3/3，但 grading 明确两边都没有交付具体学习计划或十道民法题，显示路由/边界断言可在核心交付物缺失时仍产生满分。
- 合成测试主要验证应答文本：with_skill 的 grading 在所有 eval 中均记录 fixture_files_opened=0、matter_store_reads/writes=0、network_calls=0、external_service_calls=0；基线记录也表明未实际读取附件或执行外部操作。因此这些结果不能外推到真实 Matter Store 门禁、依赖图 stale 传播、source-record 持久化、合同/案件内容质量或恶意附件下的实际权限隔离。
- benchmark 元数据写 runs_per_configuration=3，但实际只有 20 行（10 个 eval × 2 个配置）且 run_number 全为 1；因此没有重复运行可用于判断随机波动或 flaky 断言。without_skill 的 pass_rate stddev=0.3173 是不同 eval 之间的分散程度，不是同一 eval 多次运行的方差。
- 20 个运行的 time_seconds 全为 0.0，所以 delta +0.0 只能解释为没有可用的时长采集，不能据此认定两种配置同速或技能没有延迟成本。
- benchmark 中每一行的 tokens 数值都与对应 grading.execution_metrics.output_chars 完全相等，实际汇总的是输出字符数而非模型 token：with_skill 平均 4200.1 字符，without_skill 平均 6954.9 字符，少 2754.8 字符（约 39.6%），且前者范围 3900–4770、后者 6724–7580；这只说明文本更短，不能解释为 token/算力成本下降。grading 中 transcript_chars（2820 对 6687）及 tool_calls（13 对 0）又被 scope 明示为 suite-wide 指标并复制到各 eval，不能按 10 个独立运行求和或归因到具体 eval。
