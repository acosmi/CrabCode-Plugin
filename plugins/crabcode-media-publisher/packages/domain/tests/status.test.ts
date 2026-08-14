import { describe, expect, test } from 'bun:test'
import {
  APPROVAL_ACTIONS,
  APPROVAL_STATES,
  BATCH_OUTCOME_ACTIONS,
  BATCH_OUTCOMES,
  BATCH_PHASE_ACTIONS,
  BATCH_PHASES,
  CAPABILITY_ACTIONS,
  CAPABILITY_STATES,
  PUBLICATION_ITEM_ACTIONS,
  PUBLICATION_ITEM_STATES,
  STATUS_TONES,
  approvalPresentation,
  batchOutcomePresentation,
  batchPhasePresentation,
  capabilityPresentation,
  publicationItemPresentation,
  publicationEligibility,
  type StatusAction,
  type StatusPresentation,
} from '../src/index.ts'

type PresentationAccessor<State extends string> = (state: State) => StatusPresentation

function expectDimensionContract<State extends string>(
  states: readonly State[],
  accessor: PresentationAccessor<State>,
  actionPrefix: string,
): void {
  expect(Object.isFrozen(states)).toBe(true)
  expect(new Set(states).size).toBe(states.length)

  for (const state of states) {
    const presentation = accessor(state)
    expect(Object.isFrozen(presentation)).toBe(true)
    expect(Object.isFrozen(presentation.allowedActions)).toBe(true)
    expect(presentation.label).toMatch(/\p{Script=Han}/u)
    expect(presentation.description).toMatch(/\p{Script=Han}/u)
    expect(STATUS_TONES).toContain(presentation.tone)
    expect(typeof presentation.terminal).toBe('boolean')
    expect(new Set(presentation.allowedActions).size).toBe(presentation.allowedActions.length)
    expect(presentation.allowedActions.every((action) => action.startsWith(actionPrefix))).toBe(true)
    expect(accessor(state)).toBe(presentation)
  }
}

function terminalStates<State extends string>(
  states: readonly State[],
  accessor: PresentationAccessor<State>,
): State[] {
  return states.filter((state) => accessor(state).terminal)
}

describe('status dimensions', () => {
  test('freeze exact state vocabularies', () => {
    expect(CAPABILITY_STATES).toEqual(['unverified', 'stale', 'disabled', 'verified'])
    expect(BATCH_PHASES).toEqual(['draft', 'review', 'approved', 'queued', 'executing', 'terminal', 'cancelled'])
    expect(BATCH_OUTCOMES).toEqual(['pending', 'success', 'partial', 'failed', 'cancelled', 'unknown'])
    expect(APPROVAL_STATES).toEqual(['pending', 'approved', 'rejected', 'stale_approval', 'expired'])
    expect(PUBLICATION_ITEM_STATES).toEqual([
      'prepared_local',
      'remote_draft',
      'waiting_for_edge',
      'action_required',
      'blocked',
      'retry_wait',
      'submitted',
      'under_review',
      'published',
      'rejected',
      'failed',
      'cancelled',
      'unknown',
    ])
  })

  test('keep capability presentation and actions in the capability dimension', () => {
    expectDimensionContract(CAPABILITY_STATES, capabilityPresentation, 'capability.')
    expect(terminalStates(CAPABILITY_STATES, capabilityPresentation)).toEqual([])
  })

  test('keep batch phase separate from batch outcome', () => {
    expectDimensionContract(BATCH_PHASES, batchPhasePresentation, 'batch.')
    expectDimensionContract(BATCH_OUTCOMES, batchOutcomePresentation, 'batch_result.')
    expect(terminalStates(BATCH_PHASES, batchPhasePresentation)).toEqual(['terminal', 'cancelled'])
    expect(terminalStates(BATCH_OUTCOMES, batchOutcomePresentation)).toEqual([
      'success',
      'partial',
      'failed',
      'cancelled',
    ])
    expect(batchPhasePresentation('terminal').description).toContain('独立的批次结果')
    expect(batchOutcomePresentation('unknown').allowedActions).not.toContain('batch_result.retry_safe_items')
  })

  test('make every completed approval record immutable and explicit', () => {
    expectDimensionContract(APPROVAL_STATES, approvalPresentation, 'approval.')
    expect(terminalStates(APPROVAL_STATES, approvalPresentation)).toEqual([
      'approved',
      'rejected',
      'stale_approval',
      'expired',
    ])
    expect(approvalPresentation('stale_approval').allowedActions).toContain('approval.request_new')
  })

  test('never treat submitted, review, unknown, blocked, or retry wait as published', () => {
    expectDimensionContract(PUBLICATION_ITEM_STATES, publicationItemPresentation, 'publication.')
    expect(terminalStates(PUBLICATION_ITEM_STATES, publicationItemPresentation)).toEqual([
      'published',
      'rejected',
      'failed',
      'cancelled',
    ])

    for (const state of ['submitted', 'under_review', 'unknown', 'blocked', 'retry_wait'] as const) {
      const presentation = publicationItemPresentation(state)
      expect(presentation.terminal).toBe(false)
      expect(presentation.label).not.toBe('已发布')
    }

    expect(publicationItemPresentation('unknown').allowedActions).toEqual([
      'publication.reconcile',
      'publication.view_evidence',
    ])
  })

  test('namespace actions so one status dimension cannot silently consume another', () => {
    const dimensions = [
      CAPABILITY_ACTIONS,
      BATCH_PHASE_ACTIONS,
      BATCH_OUTCOME_ACTIONS,
      APPROVAL_ACTIONS,
      PUBLICATION_ITEM_ACTIONS,
    ] as const
    const actions = dimensions.flat() as StatusAction[]

    expect(dimensions.every((dimension) => Object.isFrozen(dimension))).toBe(true)
    expect(new Set(actions).size).toBe(actions.length)
  })

  test('intersects capability and item state before a target can enter approval', () => {
    for (const item of ['prepared_local', 'remote_draft', 'waiting_for_edge'] as const) {
      expect(publicationEligibility({ capability: 'verified', item })).toEqual({ eligible: true, reasons: [] })
    }
    expect(publicationEligibility({ capability: 'stale', item: 'remote_draft' })).toEqual({
      eligible: false,
      reasons: ['capability_not_verified'],
    })
    expect(publicationEligibility({ capability: 'verified', item: 'blocked' })).toEqual({
      eligible: false,
      reasons: ['item_not_preparable'],
    })
    expect(publicationEligibility({ capability: 'stale', item: 'blocked' })).toEqual({
      eligible: false,
      reasons: ['capability_not_verified', 'item_not_preparable'],
    })
  })
})
