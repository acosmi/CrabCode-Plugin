# Official Source and Case Policy

【AI 辅助草稿，需律师复核】

Use this policy whenever CrabLaw-CN relies on legislation, judicial interpretation, regulatory
guidance, or adjudicative practice.

## Source order

1. Legislation and administrative rules
   - 国家法律法规数据库: `https://flk.npc.gov.cn/`
   - 国家行政法规库: `https://xzfg.moj.gov.cn/`
   - the issuing ministry, commission, or local government official site
2. Judicial and procuratorial authority
   - 最高人民法院、最高人民检察院 official sites, gazettes, interpretations, notices, and
     guiding documents
3. Cases
   - 人民法院案例库: `https://rmfyalk.court.gov.cn/`
   - 中国裁判文书网: `https://wenshu.court.gov.cn/`
   - Supreme People's Court Gazette and official local-court sites
4. Licensed commercial databases
   - supplemental discovery and cross-checking only; record the database and stable record ID
5. Media, blogs, social posts, and secondary summaries
   - issue-discovery leads only; insufficient by themselves for `[已核验-来源]`

## Source record requirements

- A user document receives `sourceType: user-provided` and a content hash.
- Official legislation/guidance receives `official-law` or `official-guidance`.
- A judgment/reference case receives `case`.
- Unretrieved model knowledge receives `model-knowledge-verify` with
  `status: source-needs-check`.
- Record authority, retrieval date, effective status, pinpoint, access scope, and matter ID.
- Do not store credentials, access tokens, or full licensed-database exports in the matter record.

## Validity checks

For each authority, verify:

- issuing body and legal hierarchy;
- current, amended, repealed, draft, or transitional status;
- effective date and the event date relevant to the matter;
- territorial and sector scope;
- exact article/paragraph/item and any controlling exception;
- whether a secondary source has been replaced with a primary source.

## Case comparison

Create a case-comparison artifact when likely outcome, local practice, remedy proportionality, or
adjudicative divergence matters.

- Prefer guiding/reference cases and official case sources.
- Compare issue, material facts, court, date, rule/holding, differences, and weight.
- Three comparable cases are a search target, not a license to include weak matches.
- If fewer useful cases exist, record databases searched and limitations; never manufacture a case.
- A case supports an analogy or practice observation, not a universal rule unless the governing
  legal system gives it that effect.

## Failure behavior

If access is blocked, logged-in data is unavailable, or authority cannot be verified, keep the point
`[模型知识-待核]`, create the needs-check record, and state what a lawyer must verify before reliance.
