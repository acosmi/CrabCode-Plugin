export const STATUS_TONES = Object.freeze([
  'neutral',
  'info',
  'success',
  'warning',
  'danger',
] as const)

export type StatusTone = (typeof STATUS_TONES)[number]

export const CAPABILITY_STATES = Object.freeze([
  'unverified',
  'stale',
  'disabled',
  'verified',
] as const)

export type CapabilityState = (typeof CAPABILITY_STATES)[number]

export const BATCH_PHASES = Object.freeze([
  'draft',
  'review',
  'approved',
  'queued',
  'executing',
  'terminal',
  'cancelled',
] as const)

export type BatchPhase = (typeof BATCH_PHASES)[number]

export const BATCH_OUTCOMES = Object.freeze([
  'pending',
  'success',
  'partial',
  'failed',
  'cancelled',
  'unknown',
] as const)

export type BatchOutcome = (typeof BATCH_OUTCOMES)[number]

export const APPROVAL_STATES = Object.freeze([
  'pending',
  'approved',
  'rejected',
  'stale_approval',
  'expired',
] as const)

export type ApprovalState = (typeof APPROVAL_STATES)[number]

export const PUBLICATION_ITEM_STATES = Object.freeze([
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
] as const)

export type PublicationItemState = (typeof PUBLICATION_ITEM_STATES)[number]

export const PUBLICATION_ELIGIBILITY_REASONS = Object.freeze([
  'capability_not_verified',
  'item_not_preparable',
] as const)

export type PublicationEligibilityReason = (typeof PUBLICATION_ELIGIBILITY_REASONS)[number]

export type PublicationEligibility = Readonly<{
  eligible: boolean
  reasons: readonly PublicationEligibilityReason[]
}>

const PREPARABLE_PUBLICATION_STATES = new Set<PublicationItemState>([
  'prepared_local',
  'remote_draft',
  'waiting_for_edge',
])

export function publicationEligibility(args: Readonly<{
  capability: CapabilityState
  item: PublicationItemState
}>): PublicationEligibility {
  const reasons: PublicationEligibilityReason[] = []
  if (args.capability !== 'verified') reasons.push('capability_not_verified')
  if (!PREPARABLE_PUBLICATION_STATES.has(args.item)) reasons.push('item_not_preparable')
  return Object.freeze({ eligible: reasons.length === 0, reasons: Object.freeze(reasons) })
}

export const CAPABILITY_ACTIONS = Object.freeze([
  'capability.refresh',
  'capability.view_evidence',
  'capability.enable',
  'capability.disable',
] as const)

export type CapabilityAction = (typeof CAPABILITY_ACTIONS)[number]

export const BATCH_PHASE_ACTIONS = Object.freeze([
  'batch.edit',
  'batch.request_review',
  'batch.approve',
  'batch.return_to_draft',
  'batch.queue',
  'batch.invalidate_approval',
  'batch.start_execution',
  'batch.cancel',
  'batch.cancel_pending_items',
  'batch.reconcile_items',
  'batch.view_results',
] as const)

export type BatchPhaseAction = (typeof BATCH_PHASE_ACTIONS)[number]

export const BATCH_OUTCOME_ACTIONS = Object.freeze([
  'batch_result.view_progress',
  'batch_result.cancel_pending_items',
  'batch_result.view_results',
  'batch_result.export_evidence',
  'batch_result.reconcile_items',
  'batch_result.retry_safe_items',
] as const)

export type BatchOutcomeAction = (typeof BATCH_OUTCOME_ACTIONS)[number]

export const APPROVAL_ACTIONS = Object.freeze([
  'approval.approve',
  'approval.reject',
  'approval.return_for_changes',
  'approval.submit_bound_intent',
  'approval.view_binding',
  'approval.create_new_revision',
  'approval.repreview',
  'approval.request_new',
] as const)

export type ApprovalAction = (typeof APPROVAL_ACTIONS)[number]

export const PUBLICATION_ITEM_ACTIONS = Object.freeze([
  'publication.open_prepared_page',
  'publication.save_remote_draft',
  'publication.submit_bound_intent',
  'publication.cancel',
  'publication.open_remote_draft',
  'publication.bring_edge_online',
  'publication.resume_after_user_action',
  'publication.view_blocker',
  'publication.retry_after_condition_change',
  'publication.retry_when_due',
  'publication.reconcile',
  'publication.view_remote',
  'publication.view_evidence',
  'publication.create_new_intent',
] as const)

export type PublicationItemAction = (typeof PUBLICATION_ITEM_ACTIONS)[number]

export type StatusAction =
  | CapabilityAction
  | BatchPhaseAction
  | BatchOutcomeAction
  | ApprovalAction
  | PublicationItemAction

export type StatusPresentation<Action extends StatusAction = StatusAction> = Readonly<{
  label: string
  description: string
  tone: StatusTone
  terminal: boolean
  allowedActions: readonly Action[]
}>

type PresentationMap<State extends string, Action extends StatusAction> = Readonly<{
  [Key in State]: StatusPresentation<Action>
}>

function freezePresentations<State extends string, Action extends StatusAction>(
  states: readonly State[],
  presentations: { [Key in State]: StatusPresentation<Action> },
): PresentationMap<State, Action> {
  const entries = states.map((state) => {
    const presentation = presentations[state]
    return [
      state,
      Object.freeze({
        ...presentation,
        allowedActions: Object.freeze([...presentation.allowedActions]),
      }),
    ] as const
  })

  return Object.freeze(Object.fromEntries(entries)) as PresentationMap<State, Action>
}

const CAPABILITY_PRESENTATIONS = freezePresentations<CapabilityState, CapabilityAction>(
  CAPABILITY_STATES,
  {
    unverified: {
      label: '能力未验证',
      description: '尚无可核验的账号级能力证据，真实提交保持禁用。',
      tone: 'warning',
      terminal: false,
      allowedActions: ['capability.refresh', 'capability.view_evidence'],
    },
    stale: {
      label: '能力证据已过期',
      description: '现有能力证据已超过有效期，刷新并复验后才能提交。',
      tone: 'warning',
      terminal: false,
      allowedActions: ['capability.refresh', 'capability.view_evidence'],
    },
    disabled: {
      label: '能力已停用',
      description: '该账号内容类型已被策略或管理员停用。',
      tone: 'neutral',
      terminal: false,
      allowedActions: ['capability.enable', 'capability.view_evidence'],
    },
    verified: {
      label: '能力已验证',
      description: '账号级能力证据仍在有效期内，可按已验证的操作继续。',
      tone: 'success',
      terminal: false,
      allowedActions: ['capability.view_evidence', 'capability.disable'],
    },
  },
)

const BATCH_PHASE_PRESENTATIONS = freezePresentations<BatchPhase, BatchPhaseAction>(
  BATCH_PHASES,
  {
    draft: {
      label: '批次编辑中',
      description: '批次目标和变体仍可编辑，尚未进入审批。',
      tone: 'neutral',
      terminal: false,
      allowedActions: ['batch.edit', 'batch.request_review', 'batch.cancel'],
    },
    review: {
      label: '批次待审核',
      description: '正在核对目标、变体、声明和绑定哈希。',
      tone: 'info',
      terminal: false,
      allowedActions: ['batch.approve', 'batch.return_to_draft', 'batch.cancel'],
    },
    approved: {
      label: '批次已批准',
      description: '当前批次版本已获批准；任何可见变更都会使批准失效。',
      tone: 'success',
      terminal: false,
      allowedActions: ['batch.queue', 'batch.invalidate_approval', 'batch.cancel'],
    },
    queued: {
      label: '等待执行',
      description: '批次已进入执行队列，尚未开始新的外部副作用。',
      tone: 'info',
      terminal: false,
      allowedActions: ['batch.start_execution', 'batch.cancel'],
    },
    executing: {
      label: '批次执行中',
      description: '至少一个发布项正在执行或对账，结果必须按单项查看。',
      tone: 'info',
      terminal: false,
      allowedActions: ['batch.reconcile_items', 'batch.cancel_pending_items'],
    },
    terminal: {
      label: '批次流程已结束',
      description: '流程已经结束；成功与否必须读取独立的批次结果。',
      tone: 'neutral',
      terminal: true,
      allowedActions: ['batch.view_results'],
    },
    cancelled: {
      label: '批次流程已取消',
      description: '流程已取消；已经发生的外部副作用不会被伪回滚。',
      tone: 'neutral',
      terminal: true,
      allowedActions: ['batch.view_results'],
    },
  },
)

const BATCH_OUTCOME_PRESENTATIONS = freezePresentations<BatchOutcome, BatchOutcomeAction>(
  BATCH_OUTCOMES,
  {
    pending: {
      label: '结果待定',
      description: '尚无最终结果，继续查看执行进度。',
      tone: 'info',
      terminal: false,
      allowedActions: ['batch_result.view_progress', 'batch_result.cancel_pending_items'],
    },
    success: {
      label: '全部成功',
      description: '所有目标项均有可核验的成功结果。',
      tone: 'success',
      terminal: true,
      allowedActions: ['batch_result.view_results', 'batch_result.export_evidence'],
    },
    partial: {
      label: '部分完成',
      description: '目标项结果不一致，请逐项查看成功、失败或待处理证据。',
      tone: 'warning',
      terminal: true,
      allowedActions: [
        'batch_result.view_results',
        'batch_result.reconcile_items',
        'batch_result.retry_safe_items',
        'batch_result.export_evidence',
      ],
    },
    failed: {
      label: '执行失败',
      description: '批次未产生可接受的成功结果，请查看单项错误和证据。',
      tone: 'danger',
      terminal: true,
      allowedActions: [
        'batch_result.view_results',
        'batch_result.retry_safe_items',
        'batch_result.export_evidence',
      ],
    },
    cancelled: {
      label: '结果已取消',
      description: '批次在允许的阶段取消；已发生的外部副作用仍按真实结果保留。',
      tone: 'neutral',
      terminal: true,
      allowedActions: ['batch_result.view_results', 'batch_result.export_evidence'],
    },
    unknown: {
      label: '结果待核对',
      description: '外部副作用可能已经发生，必须先对账，禁止盲目重发。',
      tone: 'warning',
      terminal: false,
      allowedActions: [
        'batch_result.reconcile_items',
        'batch_result.view_results',
        'batch_result.export_evidence',
      ],
    },
  },
)

const APPROVAL_PRESENTATIONS = freezePresentations<ApprovalState, ApprovalAction>(
  APPROVAL_STATES,
  {
    pending: {
      label: '待批准',
      description: '等待具备权限的批准人审阅当前绑定内容。',
      tone: 'warning',
      terminal: false,
      allowedActions: ['approval.approve', 'approval.reject', 'approval.return_for_changes'],
    },
    approved: {
      label: '已批准',
      description: '当前批准回执已绑定确切批次版本、目标和哈希。',
      tone: 'success',
      terminal: true,
      allowedActions: ['approval.view_binding', 'approval.submit_bound_intent'],
    },
    rejected: {
      label: '已拒绝',
      description: '当前批准请求已被拒绝，不能用于提交。',
      tone: 'danger',
      terminal: true,
      allowedActions: ['approval.view_binding', 'approval.create_new_revision'],
    },
    stale_approval: {
      label: '批准已失效',
      description: '内容、目标、动作或绑定哈希已经变化，原批准不再有效。',
      tone: 'warning',
      terminal: true,
      allowedActions: ['approval.view_binding', 'approval.repreview', 'approval.request_new'],
    },
    expired: {
      label: '批准已过期',
      description: '批准回执已经超过有效期，必须重新发起批准。',
      tone: 'warning',
      terminal: true,
      allowedActions: ['approval.view_binding', 'approval.request_new'],
    },
  },
)

const PUBLICATION_ITEM_PRESENTATIONS = freezePresentations<PublicationItemState, PublicationItemAction>(
  PUBLICATION_ITEM_STATES,
  {
    prepared_local: {
      label: '已在本地页面准备',
      description: '内容只存在于本地发布页面，关闭页面可能丢失，不能称为远端草稿。',
      tone: 'info',
      terminal: false,
      allowedActions: [
        'publication.open_prepared_page',
        'publication.save_remote_draft',
        'publication.submit_bound_intent',
        'publication.cancel',
      ],
    },
    remote_draft: {
      label: '已保存远端草稿',
      description: '平台已返回可核验的草稿标识或草稿地址。',
      tone: 'info',
      terminal: false,
      allowedActions: [
        'publication.open_remote_draft',
        'publication.submit_bound_intent',
        'publication.cancel',
      ],
    },
    waiting_for_edge: {
      label: '等待发布设备上线',
      description: '目标 Edge 设备当前离线，任务尚未在平台页面执行。',
      tone: 'warning',
      terminal: false,
      allowedActions: ['publication.bring_edge_online', 'publication.cancel'],
    },
    action_required: {
      label: '需要你在发布设备处理',
      description: '平台要求登录、扫码、短信、验证码或账号确认，自动化保持停止。',
      tone: 'warning',
      terminal: false,
      allowedActions: ['publication.resume_after_user_action', 'publication.cancel'],
    },
    blocked: {
      label: '任务已阻断',
      description: '同类失败已触发熔断；只有阻塞条件可证明变化后才能再次尝试。',
      tone: 'danger',
      terminal: false,
      allowedActions: [
        'publication.view_blocker',
        'publication.retry_after_condition_change',
        'publication.cancel',
      ],
    },
    retry_wait: {
      label: '等待安全重试',
      description: '当前错误可重试，但必须等待重试窗口并沿用原意图与幂等键。',
      tone: 'warning',
      terminal: false,
      allowedActions: ['publication.retry_when_due', 'publication.reconcile', 'publication.cancel'],
    },
    submitted: {
      label: '已提交平台',
      description: '平台已经接收提交，但尚无证据证明内容已经发布。',
      tone: 'info',
      terminal: false,
      allowedActions: ['publication.reconcile', 'publication.view_evidence'],
    },
    under_review: {
      label: '平台审核中',
      description: '内容正在平台审核，继续对账，不得显示为已发布。',
      tone: 'info',
      terminal: false,
      allowedActions: ['publication.reconcile', 'publication.view_evidence'],
    },
    published: {
      label: '已发布',
      description: '已取得可核验的远端内容标识、地址或状态证据。',
      tone: 'success',
      terminal: true,
      allowedActions: ['publication.view_remote', 'publication.view_evidence'],
    },
    rejected: {
      label: '平台已拒绝',
      description: '平台已经明确拒绝该发布项，当前意图不能继续提交。',
      tone: 'danger',
      terminal: true,
      allowedActions: ['publication.view_evidence', 'publication.create_new_intent'],
    },
    failed: {
      label: '发布失败',
      description: '当前发布项已确定失败；如需再试，应创建新的受控意图。',
      tone: 'danger',
      terminal: true,
      allowedActions: ['publication.view_evidence', 'publication.create_new_intent'],
    },
    cancelled: {
      label: '发布项已取消',
      description: '未完成的发布动作已停止；已发生的外部副作用不会被伪回滚。',
      tone: 'neutral',
      terminal: true,
      allowedActions: ['publication.view_evidence'],
    },
    unknown: {
      label: '结果待核对',
      description: '外部副作用可能已经发生，必须先对账，禁止直接重发。',
      tone: 'warning',
      terminal: false,
      allowedActions: ['publication.reconcile', 'publication.view_evidence'],
    },
  },
)

export function capabilityPresentation(state: CapabilityState): StatusPresentation<CapabilityAction> {
  return CAPABILITY_PRESENTATIONS[state]
}

export function batchPhasePresentation(state: BatchPhase): StatusPresentation<BatchPhaseAction> {
  return BATCH_PHASE_PRESENTATIONS[state]
}

export function batchOutcomePresentation(state: BatchOutcome): StatusPresentation<BatchOutcomeAction> {
  return BATCH_OUTCOME_PRESENTATIONS[state]
}

export function approvalPresentation(state: ApprovalState): StatusPresentation<ApprovalAction> {
  return APPROVAL_PRESENTATIONS[state]
}

export function publicationItemPresentation(state: PublicationItemState): StatusPresentation<PublicationItemAction> {
  return PUBLICATION_ITEM_PRESENTATIONS[state]
}
