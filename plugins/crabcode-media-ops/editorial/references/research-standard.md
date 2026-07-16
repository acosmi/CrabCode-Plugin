# 研究与来源标准

## 来源评估与派生层级

1. 法规、监管、司法、机构官网、公司公告、原始数据或论文；
2. 具名专业机构和有编辑责任的媒体；
3. 当事人公开表述；
4. 二次转载、社交内容和匿名爆料，只能作为线索。

每个来源先由 `mediaops.research.capture` 形成 canonical/final URL、HTTP 状态、内容类型、访问时间、已核验/连接地址、响应字节与文本快照哈希。提交 `research.complete` 时补充标题、责任发布者、发布日期及 `assessment`：

- `publisherType`：government/court/standards_body/academic/company/professional_media/industry_organization/individual/unknown；
- `sourceFunction`：original_record/first_party_statement/official_interpretation/independent_reporting/professional_analysis/context；
- `originRelationship`：original/syndicated/unknown；
- `basisExcerpt`：能在 capture 快照中定位的分类依据；
- `classificationRationale`：说明该来源承担何种证据功能及局限。

调用方不得提交 `sourceTier`、`isPrimary`、`originPublisher` 或 `independenceGroup`。服务端核验评估字段相容性和 basisExcerpt 后派生层级/primary 状态，再按组织域、责任发布者、同页、精确快照和近似内容聚类独立组。每个证据链接记录 claimId、支持/反证关系、定位、原文片段、解释、局限和核验时间；支持关系还会核对数字、增减方向、实体和动作。关键事实尽量回到一级来源；网页找不到证据时写“未核实”，不能用常识补齐。

原始记录、第一方声明和官方解释必须同时验证责任发布者主机。政府/法院/学术站点只按内置受限机构域规则识别；其他部署者认可的官方主机可通过 `MEDIAOPS_TRUSTED_SOURCE_HOSTS` 配置精确主机或受限子域通配。精确项不含子域，通配只含子域不含裸域，非法或过宽项 fail-closed。研究包必须保留实际命中的 `publisherIdentityRule`；配置型信任另保存规范化规则集哈希 `trustedHostConfigurationHash`。这只是主机信任依据，不是内容真实性结论。

核心主张至少需要两组真正独立的支持来源，其中至少一项为原始/权威来源；若只有两家专业来源，必须降低结论强度。转载同一通稿不算独立。研究者要主动搜索反证、冲突和时效变化。

## 主张台账

每项主张标为：`verified / doubtful / unsourced`。`verified` 必须引用能在打开页面快照中定位的 evidenceLinkId，单一 URL 不足以验证；后两者在发布前修订，核心主张不得以 waiver 代替证据。

明确区分：

- 事实：来源直接支持；
- 来源解释：来源作者的分析；
- 作者推论：本文基于事实的推导，必须写出因果和边界。

用户参考文只用于检索 seed、抽象风格和原创比较，不作为独立支持来源。所有搜索为零、页面未成功打开、摘录不在快照、独立性不足或仍有反证时，`mediaops.research.complete` 必须保持 incomplete/action_required。

搜索 query/resultCount 是可信主体提交的日志，不能单独证明搜索工具确实执行；可机器验证的网络证据来自 `mediaops.research.capture` 生成的 captureId、最终 URL、响应状态、MIME、已核验/连接地址、字节/文本哈希与时间。采集器在每次请求和跳转前拒绝任何非公网解析结果，并直接拨号已核验数字地址，保留原 Host/SNI；这关闭实现内的 DNS validate/connect 重绑定窗口，但不替代部署环境的出站防火墙。

研究完成后以公开只读 `mediaops.research.get(researchId)` 交接完整结构化包；不得调用内部 getter、读取 SQLite 或从审计日志猜测服务端生成的 sourceId。

自动独立性检查会合并同一组织域、同一责任发布者、相同页面、完全相同快照和近似内容。隐蔽媒体集团关系或大幅改写的同源通稿仍须事实核查者识别。当前采集不支持 PDF，遇到 PDF 应转另行受控提取并保持 action_required，不能伪造成成功 capture。
