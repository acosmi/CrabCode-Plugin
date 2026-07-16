import { createHash } from 'node:crypto'

export type VerifiableStatement = {
  statementId: string
  location: 'title' | 'summary' | 'body'
  ordinal: number
  text: string
  signals: string[]
}

type Signature = {
  numbers: Set<string>
  predicates: Set<string>
  entities: Set<string>
  predicatePolarities: Map<string, 'affirmed' | 'negated' | 'mixed'>
}

const PREDICATES: ReadonlyArray<readonly [string, RegExp]> = [
  ['increase', /增长|上涨|上升|增加|提升|扩大|攀升|翻番|同比增|环比增|\bincreas(?:e|ed|ing)\b|\bgrow(?:s|th|n|ing)?\b|\brose\b/i],
  ['decrease', /下降|下跌|减少|降低|收缩|下滑|同比降|环比降|\bdecreas(?:e|ed|ing)\b|\bdeclin(?:e|ed|ing)\b|\bfell\b/i],
  ['acquire', /收购|并购|买下|控股|取得控制权|\bacquir(?:e|ed|ing)\b|\bmerg(?:e|ed|ing)\b/i],
  ['relocate', /迁至|迁往|迁入|搬迁|迁址|总部迁|\brelocat(?:e|ed|ing)\b|\bmov(?:e|ed|ing)\s+(?:its\s+)?(?:headquarters|operations)\b/i],
  ['locate', /位于|坐落于|总部在|总部设在|\b(?:is|are|was|were)\s+(?:headquartered|located|based)\s+in\b/i],
  ['launch', /发布|推出|上线|开通|启用|\blaunch(?:ed|es|ing)?\b|\breleas(?:e|ed|es|ing)\b/i],
  ['announce', /宣布|公告|披露|通报|表示|称|\bannounc(?:e|ed|es|ing)\b|\bdisclos(?:e|ed|es|ing)\b/i],
  ['establish', /成立|设立|创建|组建|\bestablish(?:ed|es|ing)?\b|\bfound(?:ed|ing)?\b/i],
  ['approve', /获批|批准|许可|认证|通过审查|\bapprov(?:e|ed|es|ing)\b|\bauthori[sz](?:e|ed|es|ing)\b/i],
  ['prohibit', /禁止|不得|叫停|封禁|\bprohibit(?:ed|s|ing)?\b|\bban(?:ned|s|ning)?\b/i],
  ['penalize', /处罚|罚款|立案|违法|违规|责令整改|\bfin(?:e|ed|es|ing)\b|\bpenali[sz](?:e|ed|es|ing)\b|\bviolat(?:e|ed|es|ion)\b/i],
  ['invest', /投资|注资|增资|入股|\binvest(?:ed|s|ing|ment)\b/i],
  ['finance', /融资|募资|筹资|\bfundrais(?:e|ed|es|ing)\b|\bfinanc(?:e|ed|es|ing)\b/i],
  ['rule', /规定|要求|决定|判决|裁定|生效|实施|\brequir(?:e|ed|es|ing)\b|\brul(?:e|ed|es|ing)\b|\bdecid(?:e|ed|es|ing)\b/i],
  ['leak', /泄露|泄漏|外泄|数据泄密|暴露(?:了)?(?:用户|个人|客户)?(?:信息|数据|记录)|\bleak(?:ed|s|ing)?\b|\bbreach(?:ed|es|ing)?\b/i],
  ['collect', /收集|采集|获取(?:了)?(?:用户|个人|客户)?(?:信息|数据)|\bcollect(?:ed|s|ing)?\b|\bharvest(?:ed|s|ing)?\b/i],
  ['share', /共享|分享|提供给|转交|出售|售卖|\bshar(?:e|ed|es|ing)\b|\bsell(?:s|ing)?\b|\bsold\b/i],
  ['store', /存储|保存|留存|保留|\bstor(?:e|ed|es|ing)\b|\bretain(?:ed|s|ing)?\b/i],
  ['access', /访问|读取|查看|调取|\baccess(?:ed|es|ing)?\b|\bread(?:s|ing)?\b/i],
  ['transmit', /传输|发送|上传|下发|\btransmit(?:ted|s|ting)?\b|\bsend(?:s|ing)?\b|\bsent\b|\bupload(?:ed|s|ing)?\b/i],
  ['delete', /删除|清除|销毁|\bdelet(?:e|ed|es|ing)\b|\berase(?:d|s|ing)?\b/i],
  ['suspend', /暂停|中止|停用|下架|\bsuspend(?:ed|s|ing)?\b|\bhalt(?:ed|s|ing)?\b/i],
  ['close', /关闭|关停|终止运营|停止服务|\bclos(?:e|ed|es|ing)\b|\bshut\s+down\b/i],
  ['support', /支持|兼容|可用|开放使用|\bsupport(?:ed|s|ing)?\b|\bcompatib(?:le|ility)\b|\bavailable\b/i],
]

const OPPOSITES: Readonly<Record<string, string>> = {
  increase: 'decrease',
  decrease: 'increase',
}

const ENTITY_SIGNAL = /[\p{Script=Han}A-Za-z0-9·&]{2,}(?:公司|集团|平台|机构|法院|部门|大学|研究院|政府|委员会|银行|协会|中心)/u
const ENTITY_TOKEN_PATTERN = /[\p{Script=Han}A-Za-z0-9·&]{2,16}?(?:公司|集团|平台|机构|法院|部门|大学|研究院|政府|委员会|银行|协会|中心)/gu
const LOCATION_COMPLEMENT_PATTERN = /(?:迁至|迁往|迁入|位于|总部在)([\p{Script=Han}A-Za-z·-]{2,20})/gu
const LATIN_BRAND_ENTITY_PATTERN = /\b(?:[A-Z]{3,}[A-Za-z0-9.-]*|[A-Z][a-z]+[A-Z][A-Za-z0-9.-]*)\b/g
const ATTRIBUTION_SIGNAL = /(?:据|根据|数据显示|报告显示|公告称|监管|法院|研究发现|调查显示|官方|统计|文件指出)/
const NUMBER_PATTERN = /(?:19|20)\d{2}(?:年|[-/.]\d{1,2}(?:[-/.]\d{1,2})?)?|[-+]?\d+(?:\.\d+)?\s*(?:%|％|万|亿|万元|亿元|万人|倍|家|项|起|例|美元|人民币|元)?/g
const NEGATION_BEFORE_PREDICATE = /(?:并未|没有|未曾|从未|尚未|不再|并不|未|不|否认|never|not|no\s+longer|did(?:n't|\s+not)|does(?:n't|\s+not)|is(?:n't|\s+not)|was(?:n't|\s+not))[^，。！？!?；;]{0,8}$/i
const ATTRIBUTION_PREFIX = /^.*?(?:数据显示|报告显示|公告称|公开材料显示|研究发现|调查显示|根据|据)/u
const TRAILING_NEGATION = /(?:并未|没有|未曾|从未|尚未|不再|并不|未|不|否认)$/u
const NON_SUBJECT_PREFIX = /^(?:截至|目前|已经|已|将|可能|或将|预计|大约|约)/u

function normalizeText(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, '').replace(/[，。！？；：、,.!?;:'"“”‘’（）()【】\[\]{}]/g, '')
}

function canonicalNumber(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, '').replace(/％/g, '%')
}

export function semanticSignature(value: string): Signature {
  const numbers = new Set((value.match(NUMBER_PATTERN) ?? []).map(canonicalNumber))
  const predicates = new Set<string>()
  const entities = new Set<string>()
  const predicatePolarities = new Map<string, 'affirmed' | 'negated' | 'mixed'>()
  for (const [name, pattern] of PREDICATES) {
    const global = new RegExp(pattern.source, `${pattern.flags.replace(/g/g, '')}g`)
    const polarities = new Set<'affirmed' | 'negated'>()
    for (const match of value.matchAll(global)) {
      predicates.add(name)
      const prefix = value.slice(Math.max(0, (match.index ?? 0) - 24), match.index ?? 0)
      polarities.add(NEGATION_BEFORE_PREDICATE.test(prefix) ? 'negated' : 'affirmed')
    }
    if (polarities.size === 1) predicatePolarities.set(name, [...polarities][0])
    else if (polarities.size > 1) predicatePolarities.set(name, 'mixed')
  }
  for (const match of value.matchAll(ENTITY_TOKEN_PATTERN)) entities.add(normalizeText(match[0]))
  for (const match of value.matchAll(LOCATION_COMPLEMENT_PATTERN)) entities.add(normalizeText(match[1]))
  for (const match of value.matchAll(LATIN_BRAND_ENTITY_PATTERN)) entities.add(normalizeText(match[0]))
  const substantiveMatches = PREDICATES
    .filter(([name]) => name !== 'announce')
    .flatMap(([, pattern]) => {
      const match = new RegExp(pattern.source, pattern.flags.replace(/g/g, '')).exec(value)
      return match?.index === undefined ? [] : [match.index]
    })
    .sort((left, right) => left - right)
  if (substantiveMatches.length) {
    const predicateIndex = substantiveMatches[0]
    const boundary = Math.max(value.lastIndexOf('。', predicateIndex - 1), value.lastIndexOf('；', predicateIndex - 1), value.lastIndexOf(';', predicateIndex - 1), value.lastIndexOf('\n', predicateIndex - 1))
    let candidate = value.slice(boundary + 1, predicateIndex).trim()
      .replace(ATTRIBUTION_PREFIX, '')
      .replace(NON_SUBJECT_PREFIX, '')
      .replace(/(?:在)?(?:19|20)\d{2}年.*$/u, '')
      .replace(TRAILING_NEGATION, '')
      .replace(/[的在于与和、，,:：\s]+$/u, '')
      .trim()
    if (/^[\p{Script=Han}A-Za-z][\p{Script=Han}A-Za-z0-9·&.\-]{1,39}$/u.test(candidate)) {
      entities.add(normalizeText(candidate))
    }
  }
  return { numbers, predicates, entities, predicatePolarities }
}

function sentenceParts(value: string): string[] {
  return value
    .replace(/\r\n?/g, '\n')
    .split(/(?<=[。！？!?；;])|\n+/u)
    .map((part) => part.trim().replace(/^[#>*+\-\d.、)\s]+/, '').replace(/[。！？!?；;]+$/, '').trim())
    .filter((part) => part.length >= 4)
}

function statementSignals(text: string): string[] {
  const signature = semanticSignature(text)
  const signals = [
    ...[...signature.numbers].map((number) => `number:${number}`),
    ...[...signature.predicates].map((predicate) => `predicate:${predicate}`),
  ]
  if (signature.entities.size > 0 || ENTITY_SIGNAL.test(text)) signals.push('named-entity')
  if (ATTRIBUTION_SIGNAL.test(text)) signals.push('attribution')
  return [...new Set(signals.length ? signals : ['declarative-candidate'])].sort()
}

export function extractVerifiableStatements(input: { title: string; summary?: string; bodyText: string }): VerifiableStatement[] {
  const locations: Array<readonly ['title' | 'summary' | 'body', string]> = [
    ['title', input.title],
    ['summary', input.summary ?? ''],
    ['body', input.bodyText],
  ]
  const output: VerifiableStatement[] = []
  for (const [location, value] of locations) {
    for (const [ordinal, text] of sentenceParts(value).entries()) {
      const signals = statementSignals(text)
      const statementId = createHash('sha256')
        .update(JSON.stringify({ location, ordinal, text: normalizeText(text) }))
        .digest('hex')
      output.push({ statementId, location, ordinal, text, signals })
    }
  }
  return output
}

/**
 * Deterministic guard for obvious quantitative or directional mismatches.
 * This intentionally does not claim semantic understanding; accountable
 * human review remains mandatory for mappings that survive these checks.
 */
export function factualCompatibility(subject: string, evidence: string): string[] {
  const subjectSignature = semanticSignature(subject)
  const evidenceSignature = semanticSignature(evidence)
  const evidenceNormalized = normalizeText(evidence)
  const issues: string[] = []
  if (subjectSignature.numbers.size === 0 && subjectSignature.predicates.size === 0 && subjectSignature.entities.size === 0) {
    issues.push('subject has no machine-checkable factual signals')
  }
  for (const number of subjectSignature.numbers) {
    if (!evidenceNormalized.includes(normalizeText(number))) issues.push(`missing quantitative token ${number}`)
  }
  for (const predicate of subjectSignature.predicates) {
    const opposite = OPPOSITES[predicate]
    if (opposite && evidenceSignature.predicates.has(opposite)) {
      issues.push(`opposite direction ${predicate}/${opposite}`)
    } else if (!evidenceSignature.predicates.has(predicate)) {
      issues.push(`missing factual predicate ${predicate}`)
    } else {
      const subjectPolarity = subjectSignature.predicatePolarities.get(predicate)
      const evidencePolarity = evidenceSignature.predicatePolarities.get(predicate)
      if (subjectPolarity !== evidencePolarity || subjectPolarity === 'mixed') {
        issues.push(`predicate polarity mismatch ${predicate}:${subjectPolarity ?? 'unknown'}/${evidencePolarity ?? 'unknown'}`)
      }
    }
  }
  for (const entity of subjectSignature.entities) {
    if (!evidenceNormalized.includes(entity)) issues.push(`missing entity/location ${entity}`)
  }
  return issues
}
