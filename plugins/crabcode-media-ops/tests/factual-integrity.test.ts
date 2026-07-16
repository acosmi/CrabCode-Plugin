import { describe, expect, test } from 'bun:test'
import { extractVerifiableStatements, factualCompatibility } from '../src/factual-integrity.ts'

describe('factual statement detection', () => {
  test('treats a location assertion with a Latin brand name as verifiable', () => {
    const statements = extractVerifiableStatements({
      title: '观点文章',
      bodyText: 'OpenAI总部位于旧金山。',
    })
    expect(statements).toHaveLength(2)
    const body = statements.find((statement) => statement.location === 'body')!
    expect(body.signals).toContain('named-entity')
    expect(body.signals).toContain('predicate:locate')
    expect(factualCompatibility(body.text, 'OpenAI总部位于纽约')).toContain('missing entity/location 旧金山')
  })

  test('keeps every visible sentence in the accountable ledger', () => {
    const statements = extractVerifiableStatements({ title: '我的看法', bodyText: '微信泄露了用户聊天记录。\n这让我很担心。' })
    expect(statements).toHaveLength(3)
    expect(statements.find((statement) => statement.text.includes('微信泄露'))?.signals).toContain('predicate:leak')
    expect(statements.find((statement) => statement.text === '这让我很担心')?.signals).toEqual(['declarative-candidate'])
  })

  test('rejects negation reversal and cross-claim evidence assembly', () => {
    expect(factualCompatibility('Acme公司并未增长10%', 'Acme公司增长10%').join('|')).toContain('predicate polarity mismatch increase:negated/affirmed')
    expect(factualCompatibility('Acme公司增长10%', 'Acme公司成立').length).toBeGreaterThan(0)
    expect(factualCompatibility('Acme公司增长10%', '整个市场增长10%').join('|')).toContain('missing entity/location acme公司')
  })

  test('fails closed when a claim has no machine-checkable factual structure', () => {
    expect(factualCompatibility('天空是蓝色', '天空是蓝色')).toContain('subject has no machine-checkable factual signals')
  })
})
