import {
  approvalPresentation,
  batchOutcomePresentation,
  batchPhasePresentation,
  capabilityPresentation,
  publicationEligibility,
  publicationItemPresentation
} from "../../../packages/domain/src/index.ts";
import { accounts, attentionItems, auditEvents, batch, dashboardMetrics, demoClock, variants, work, workspace } from "./fixtures.ts";
import { button, card, emptyState, escapeHtml, factBadge, keyValue, pageHeader, statusBadge } from "./components.ts";
import { icon } from "./icons.ts";

export type RouteDefinition = {
  label: string;
  title: string;
  render: () => string;
};

function metricCards(): string {
  return `<div class="metric-grid">${dashboardMetrics.map((metric) => `<article class="metric-card metric-${metric.tone}">
    <p>${escapeHtml(metric.label)}</p><strong>${escapeHtml(metric.value)}</strong><span>${escapeHtml(metric.detail)}</span>
  </article>`).join("")}</div>`;
}

function dashboard(): string {
  const attention = attentionItems.map((item) => {
    const status = publicationItemPresentation(item.status);
    return `<li class="attention-item">
      <div class="attention-mark status-${escapeHtml(status.tone)}">${icon(status.tone === "neutral" ? "clock" : "alert")}</div>
      <div><div class="attention-title"><h3>${escapeHtml(item.title)}</h3>${statusBadge(status, true)}</div><p>${escapeHtml(item.detail)}</p><span>${escapeHtml(item.meta)}</span></div>
      <a class="icon-link" href="${escapeHtml(item.route)}" data-route aria-label="处理：${escapeHtml(item.title)}">${icon("chevron")}</a>
    </li>`;
  }).join("");
  return `${pageHeader({
    eyebrow: "工作台 · 本地受控演示",
    title: "下午好，傅**",
    description: "先处理会影响审批与结果真实性的事项，再继续新的分发任务。",
    actions: button("打开内容库", { route: "/app/works", iconName: "arrow" })
  })}${metricCards()}<div class="dashboard-grid">${card({
    title: "需要你处理",
    description: "按风险排序；警告会持续保留，不依赖临时提示。",
    content: `<ul class="attention-list">${attention}</ul>`
  })}${card({
    title: "本地安全边界",
    description: "此界面没有任何真实平台发布权限。",
    className: "security-card",
    content: `<div class="security-summary">${icon("shield", "security-icon")}<div><strong>所有副作用均已关闭</strong><p>固定 fixture 只用于视觉、状态语义与无障碍验收；Cookie、验证码和平台 token 不进入 Hub。</p></div></div>
      <dl class="compact-dl">${keyValue("内容 revision", work.revision, { mono: true })}${keyValue("Edge", "1 在线 · 1 离线")}${keyValue("演示时钟", demoClock)}</dl>`
  })}</div>`;
}

function worksList(): string {
  return `${pageHeader({ eyebrow: "内容", title: "作品与 revision", description: "HTML 是默认阅读交付，Markdown 保留为同 revision 备份。", actions: button("新建内容", { disabled: true, variant: "primary", iconName: "plus", title: "本地演示未连接内容服务" }) })}
    ${card({ content: `<div class="table-wrap"><table class="responsive-table works-table"><caption class="sr-only">内容列表</caption><thead><tr><th scope="col">作品</th><th scope="col">Revision</th><th scope="col">作者</th><th scope="col">状态</th><th scope="col"><span class="sr-only">操作</span></th></tr></thead><tbody><tr><td data-label="作品"><a href="/app/works/${work.id}/edit" data-route><strong>${escapeHtml(work.title)}</strong></a><span class="cell-detail">${escapeHtml(work.summary)}</span></td><td class="mono" data-label="Revision">${escapeHtml(work.revision)}</td><td data-label="作者">${escapeHtml(work.author)}</td><td data-label="状态">${statusBadge(publicationItemPresentation("prepared_local"), true)}</td><td data-label="操作">${button("打开", { route: `/app/works/${work.id}/edit`, variant: "quiet" })}</td></tr></tbody></table></div>` })}`;
}

function editor(): string {
  return `<div class="editor-page">${pageHeader({
    eyebrow: `内容 · ${work.revision}`,
    title: work.title,
    description: `最后冻结于 ${work.frozenAt} · ${work.wordCount.toLocaleString("zh-CN")} 字 · ${work.sourceCount} 个来源`,
    actions: `${button("保存本页草稿", { action: "save-revision" })}${button("冻结并生成变体", { route: `/app/works/${work.id}/variants`, variant: "primary", iconName: "arrow" })}`
  })}<div class="editor-grid">
    <aside class="editor-outline" aria-label="文章结构"><div class="panel-title"><h2>编辑导航</h2><span>5 项</span></div><nav><a class="active" href="#editor-title">文章标题</a><a href="#editor-summary">导语</a><a href="#editor-body">正文</a><a href="#article-preview">HTML 预览</a><a href="#save-state">保存状态</a></nav><div class="outline-meta"><span>当前 revision</span><strong class="mono">${escapeHtml(work.revision)}</strong><span>内容哈希</span><strong class="mono">${escapeHtml(work.hash)}</strong></div></aside>
    <section class="editor-canvas" aria-labelledby="editor-title"><div class="rich-toolbar" role="toolbar" aria-label="正文格式"><button type="button" aria-label="加粗"><strong>B</strong></button><button type="button" aria-label="二级标题">H2</button><button type="button" aria-label="引用">“”</button><button type="button" aria-label="项目列表">•—</button><span class="toolbar-separator"></span><span class="save-state" id="save-state" role="status" aria-live="polite">固定 fixture · 尚无本页改动</span></div><div class="editor-fields"><label for="editor-title">文章标题</label><textarea id="editor-title" rows="2">${escapeHtml(work.title)}</textarea><label for="editor-summary">导语</label><textarea id="editor-summary" rows="3">${escapeHtml(work.summary)}</textarea><label for="editor-body">正文</label><textarea id="editor-body" rows="18">真正可靠的“一键发布”，不是少点一次按钮，而是让每个平台收到适合它、又能追溯到同一事实源的内容。\n\n一个作品可以有多个平台变体，但事实、来源与披露应绑定到同一 ContentRevision。普通微博与微博长博文不是同一发布项，头条文章和微头条也不能靠截断字符来假装差异化。\n\n当平台没有返回可核验 ID 或公开 URL 时，结果只能是“待核对”，系统必须禁止盲目重发。</textarea></div></section>
    <aside class="inspector" aria-label="检查与 HTML 预览"><div class="inspector-tabs"><span class="active">HTML 预览</span><span>检查摘要</span></div><div class="preview-frame"><div class="preview-label"><span>规范预览</span><span>白底 · 704 px</span></div><iframe id="article-preview" title="文章白底 HTML 规范预览" sandbox="" referrerpolicy="no-referrer"></iframe></div><div class="checklist"><div>${icon("check")}<span>8 个来源已绑定</span></div><div>${icon("check")}<span>AI 辅助披露已填写</span></div><div>${icon("check")}<span>HTML / MD 同 revision</span></div></div></aside>
  </div></div>`;
}

function variantsPage(): string {
  const rows = variants.map((variant) => {
    const capability = capabilityPresentation(variant.capability);
    const state = publicationItemPresentation(variant.status);
    return `<li class="variant-item${variant.status === "blocked" ? " is-blocked" : ""}"><div class="platform-avatar" aria-hidden="true">${escapeHtml(variant.platform.slice(0, 1))}</div><div class="variant-main"><div class="variant-title"><h3>${escapeHtml(variant.platform)} · ${escapeHtml(variant.type)}</h3>${statusBadge(state, true)}</div><p>${escapeHtml(variant.account)} · ${escapeHtml(variant.chars)}</p><div class="variant-meta">${statusBadge(capability, true)}<span>风险：${escapeHtml(variant.risk)}</span></div></div>${button("查看", { variant: "quiet", action: "select-variant", data: { variant: variant.id } })}</li>`;
  }).join("");
  return `${pageHeader({ eyebrow: `平台变体 · ${work.revision}`, title: "一个事实源，六个独立发布项", description: "每个“平台账号 + 内容类型”单独校验、预览和审批。", actions: button("准备发布批次", { route: "/app/batches/new", variant: "primary", iconName: "arrow" }) })}
    <div class="variants-layout">${card({ title: "发布项", description: "能力、状态和风险是三个独立维度。", className: "variant-list-card", content: `<ul class="variant-list">${rows}</ul>` })}
    <div class="variant-detail"><div class="blocking-panel" role="alert">${icon("alert")}<div><strong>相似度阻断：今日头条文章 / 微头条</strong><p>两个变体可见文本相似度为 91%。请重新组织微头条观点与结构，复核后才可进入审批。</p></div></div>${card({ title: "规范预览 · 微博长博文", description: "Adapter 0.1 fixture · 能力核验于 2026-07-18 12:20 CST", content: `<div class="mock-post"><div class="mock-author"><span class="avatar">A</span><div><strong>Acosmi 科技</strong><span>微博长博文 · 草稿动作</span></div></div><h3>${escapeHtml(work.title)}</h3><p>${escapeHtml(work.summary)}</p><div class="mock-cover"><span>白底封面占位</span></div><dl class="compact-dl">${keyValue("包装短文", "真正的一键分发，先从不复制开始。")}${keyValue("能力", "已核验 · 保存草稿 / 人工确认")}${keyValue("目标", "wb_••91 · 微博长博文")}</dl></div>` })}</div></div>`;
}

function batchNew(): string {
  const targets = variants.slice(0, 5).map((variant) => {
    const eligibility = publicationEligibility({ capability: variant.capability, item: variant.status });
    const reason = eligibility.eligible
      ? "可进入本地审批预览"
      : eligibility.reasons.map((item) => item === "capability_not_verified" ? "能力未在有效期内" : "当前发布项不可进入审批").join("；");
    return `<label class="check-row${eligibility.eligible ? "" : " is-disabled"}"><input type="checkbox" ${eligibility.eligible ? "checked" : "disabled"}><span><strong>${escapeHtml(variant.platform)} · ${escapeHtml(variant.type)}</strong><small>${escapeHtml(variant.account)} · ${escapeHtml(reason)}</small></span></label>`;
  }).join("");
  return `${pageHeader({ eyebrow: "发布批次 · 新建", title: "确认目标与动作", description: "一次批准可以覆盖多个独立发布项，但不能跳过逐项预览。" })}
    <div class="form-layout">${card({ title: "批次设置", description: "固定 fixture 不会向任何平台发起请求。", content: `<form class="stack-form"><label for="schedule">执行时间</label><select id="schedule"><option>立即执行 · Asia/Shanghai</option><option disabled>定时发布（演示未启用）</option></select><fieldset><legend>包含的发布项</legend>${targets}</fieldset><div class="inline-warning">${icon("alert")}<p>阻断或能力非 verified 的项目无法选择；变更目标会产生新 batch revision。</p></div><div class="form-actions">${button("返回变体", { route: `/app/works/${work.id}/variants` })}${button("生成本地审批预览", { route: `/app/batches/${batch.id}/review`, variant: "primary", iconName: "arrow" })}</div></form>` })}${card({ title: "目标摘要", content: `<dl class="summary-list">${keyValue("作品", work.title, { wide: true })}${keyValue("Content revision", work.revision, { mono: true })}${keyValue("可选发布项", "3 项 · 未触发真实提交")}${keyValue("能力 / 风险阻断", "2 项不可选")}${keyValue("审批状态", "尚未生成真实批准")}</dl>` })}</div>`;
}

function review(): string {
  const approval = approvalPresentation(batch.approval);
  return `${pageHeader({ eyebrow: `审批 · ${batch.revision}`, title: "批准已失效，需要重新预览", description: "目标集合在批准后发生变化；旧批准不能用于当前 payload。", actions: statusBadge(approval) })}
    <div class="review-layout"><section class="review-main"><div class="stale-banner" role="alert">${icon("lock")}<div><strong>${escapeHtml(approval.label)}</strong><p>${escapeHtml(approval.description)}</p></div></div>${card({ title: "不可变审批摘要", description: "以下字段共同绑定到一次性批准。", content: `<dl class="detail-grid">${keyValue("作品 / revision", `${work.title} · ${work.revision}`, { wide: true })}${keyValue("目标集合", "5 个发布项")}${keyValue("动作", "立即发布 4 · 保存草稿 1")}${keyValue("计划", batch.scheduledFor)}${keyValue("目标哈希", batch.targetHash, { mono: true })}${keyValue("预览哈希", batch.previewHash, { mono: true })}${keyValue("原批准人", batch.approver)}${keyValue("批准时间", batch.approvedAt)}</dl>` })}${card({ title: "声明与风险", content: `<ul class="declaration-list"><li>${icon("check")}<span><strong>原创声明</strong>由用户明确确认，不由自动化代勾。</span></li><li>${icon("check")}<span><strong>AI 辅助披露</strong>${escapeHtml(work.disclosure)}</span></li><li>${icon("alert")}<span><strong>结果边界</strong>提交、审核中与已发布必须分别呈现。</span></li></ul>` })}</section><aside class="approval-sidebar">${card({ title: "审批动作", description: "本地演示未连接 OIDC / WebAuthn。", content: `<div class="approval-lock">${icon("shield", "security-icon")}<strong>真实批准已关闭</strong><p>必须由后端强身份生成一次性 approval；前端的“已确认”布尔值无效。</p></div>${button("重新生成预览哈希", { action: "refresh-preview" })}${button("使用强身份批准", { disabled: true, variant: "primary", iconName: "lock", title: "需要部署 OIDC / WebAuthn 与审批服务" })}${button("拒绝并返回修改", { route: `/app/works/${work.id}/variants`, variant: "danger" })}` })}</aside></div>`;
}

function batchResult(): string {
  const phase = batchPhasePresentation(batch.phase);
  const outcome = batchOutcomePresentation(batch.outcome);
  const rows = batch.items.map((item) => {
    const state = publicationItemPresentation(item.state);
    return `<tr><td data-label="平台 / 账号"><strong>${escapeHtml(item.platform)}</strong><span class="cell-detail">${escapeHtml(item.account)}</span></td><td data-label="体裁 / 动作">${escapeHtml(item.type)}<span class="cell-detail">${escapeHtml(item.action)}</span></td><td data-label="状态">${statusBadge(state, true)}</td><td data-label="观察时间">${escapeHtml(item.observedAt)}</td><td data-label="远端证据"><span class="evidence-text">${escapeHtml(item.evidence)}</span></td><td data-label="操作">${item.state === "unknown" ? button("先对账", { variant: "secondary", action: "reconcile" }) : button("证据", { variant: "quiet", action: "evidence" })}</td></tr>`;
  }).join("");
  return `${pageHeader({ eyebrow: `批次结果 · ${batch.id}`, title: "部分完成，两个项目需要处理", description: "总体结果不覆盖单项事实；未知结果只能先对账。", actions: `${statusBadge(phase)}${statusBadge(outcome)}` })}
    <div class="result-summary"><div><span>已发布</span><strong>1</strong></div><div><span>审核中</span><strong>1</strong></div><div><span>远端草稿</span><strong>1</strong></div><div><span>人工处理</span><strong>1</strong></div><div><span>结果待核对</span><strong>1</strong></div></div>
    ${card({ title: "单项结果与证据", description: `最后对账：${demoClock}`, content: `<div class="table-wrap"><table class="result-table"><caption class="sr-only">批次单项结果</caption><thead><tr><th scope="col">平台 / 账号</th><th scope="col">体裁 / 动作</th><th scope="col">状态</th><th scope="col">观察时间</th><th scope="col">远端证据</th><th scope="col"><span class="sr-only">操作</span></th></tr></thead><tbody>${rows}</tbody></table></div>` })}`;
}

function accountsPage(): string {
  const accountCards = accounts.map((account) => `<article class="account-card"><header><div class="platform-avatar">${escapeHtml(account.platform.slice(0, 1))}</div><div><h2>${escapeHtml(account.platform)}</h2><p>${escapeHtml(account.account)}</p></div>${statusBadge(capabilityPresentation(account.verifiedAt.startsWith("未完成") ? "unverified" : "verified"), true)}</header><dl class="account-meta">${keyValue("发布设备", account.edge)}${keyValue("能力核验", account.verifiedAt)}</dl><div class="capability-list">${account.capabilities.map((capability) => `<div><div><strong>${escapeHtml(capability.type)}</strong><span>${escapeHtml(capability.action)}</span></div>${statusBadge(capabilityPresentation(capability.state), true)}</div>`).join("")}</div><footer>${button("刷新能力", { disabled: true, title: "需要已配对 Edge 或官方 Connector" })}${button("查看设备", { route: "/app/settings/edge", variant: "quiet" })}</footer></article>`).join("");
  return `${pageHeader({ eyebrow: "账号与能力", title: "连接不是一个布尔值", description: "每个账号按内容类型和动作分别核验；过期或未验证能力不能真实提交。", actions: button("连接账号", { disabled: true, variant: "primary", iconName: "plus", title: "本地验收版不接收平台凭据" }) })}<div class="accounts-grid">${accountCards}</div>`;
}

function auditPage(): string {
  const rows = auditEvents.map((event) => {
    const result = event.dimension === "publication"
      ? statusBadge(publicationItemPresentation(event.result), true)
      : event.dimension === "approval"
        ? statusBadge(approvalPresentation(event.result), true)
        : factBadge("内容已冻结", "Content revision 与预览哈希已冻结；这不是发布结果。", "success", true);
    return `<tr><td class="mono" data-label="时间">${escapeHtml(event.time)}</td><td data-label="执行者">${escapeHtml(event.actor)}</td><td data-label="事件 / 对象"><strong>${escapeHtml(event.event)}</strong><span class="cell-detail">${escapeHtml(event.object)}</span></td><td class="mono" data-label="证据">${escapeHtml(event.evidence)}</td><td data-label="结果">${result}</td></tr>`;
  }).join("");
  return `${pageHeader({ eyebrow: "审计与证据", title: "每一步都有脱敏、可追溯的记录", description: "界面只展示证据标识与哈希，不暴露 Cookie、验证码或原始 token。", actions: button("导出脱敏清单", { disabled: true, iconName: "external", title: "演示 fixture 不提供导出" }) })}${card({ content: `<div class="table-wrap"><table class="responsive-table audit-table"><caption class="sr-only">审计事件</caption><thead><tr><th scope="col">时间</th><th scope="col">执行者</th><th scope="col">事件 / 对象</th><th scope="col">证据</th><th scope="col">结果</th></tr></thead><tbody>${rows}</tbody></table></div>` })}`;
}

function edgePage(): string {
  return `${pageHeader({ eyebrow: "设置与 Edge", title: "发布登录态留在用户设备", description: "Hub 只调度已配对 Edge；不集中托管平台 Cookie。", actions: button("配对新设备", { disabled: true, variant: "primary", iconName: "plus", title: "需要真实 Hub 配对服务" }) })}
    <div class="edge-grid">${card({ title: "Mac Studio ••••92AF", description: "在线 · 最后心跳 14:19:52", className: "device-card", headerAction: factBadge("在线", "Edge 心跳在有效窗口内；不代表平台内容已发布。", "success", true), content: `<div class="device-visual">${icon("edge", "device-icon")}<div><strong>Edge 0.1.0 fixture</strong><span>Chrome 150.0.7871.116 · macOS</span></div></div><dl class="detail-grid">${keyValue("设备指纹", "edge_f8a2…92AF", { mono: true })}${keyValue("受支持 origin", "weibo.com · mp.toutiao.com")}${keyValue("会话", "微博需账号确认 · 头条正常")}${keyValue("更新策略", "签名包 · 管理员批准")}</dl>` })}${card({ title: "MacBook Pro ••••114C", description: "离线 · 最后心跳 2026-07-17 22:08", className: "device-card is-offline", headerAction: factBadge("离线", "Edge 心跳已经超过有效窗口，不能接收任务。", "warning", true), content: `<div class="device-visual">${icon("edge", "device-icon")}<div><strong>Edge 0.0.9 · 需要升级</strong><span>大鱼号能力核验已经过期</span></div></div><div class="inline-warning">${icon("alert")}<p>离线设备不会接收新任务；已排队任务可安全取消。</p></div>${button("安全取消待处理任务", { variant: "danger", action: "cancel-queued" })}` })}</div>`;
}

function edgeCasesPage(): string {
  const publicationStates = ["blocked", "retry_wait", "rejected", "failed", "cancelled"] as const;
  const publicationCards = publicationStates.map((state) => {
    const presentation = publicationItemPresentation(state);
    return `<article class="edge-state-card"><div>${statusBadge(presentation)}</div><h2>${escapeHtml(state)}</h2><p>${escapeHtml(presentation.description)}</p><span>${presentation.terminal ? "终态：是" : "终态：否"} · ${presentation.allowedActions.length} 个受控动作</span></article>`;
  }).join("");
  const failClosedCases = [
    { code: "unauthorized", title: "未授权", detail: "当前身份没有批次批准权限；审批与提交保持禁用。" },
    { code: "session_expired", title: "身份会话已过期", detail: "需要重新完成强身份验证，不接受前端缓存的确认状态。" },
    { code: "hash_mismatch", title: "审批哈希不匹配", detail: "预览、目标或素材发生变化；原 approval 立即失效。" },
    { code: "edit_conflict", title: "编辑冲突", detail: "远端 revision 已前进；本地内容不静默覆盖，必须人工合并。" }
  ];
  return `${pageHeader({ eyebrow: "QA · 敌意状态", title: "高风险状态必须清晰并保持关闭", description: "固定夹具验证错误文案、终态语义和禁止绕过行为；此路由不出现在生产主导航。" })}
    <section class="qa-section" aria-labelledby="fail-closed-heading"><div class="section-heading"><h2 id="fail-closed-heading">身份、绑定与编辑冲突</h2><p>所有情况都需要恢复真实前置条件，不提供隐藏继续入口。</p></div><div class="fail-closed-grid">${failClosedCases.map((item) => `<article class="fail-closed-card"><div class="fail-code mono">${escapeHtml(item.code)}</div>${icon("lock", "security-icon")}<h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.detail)}</p>${button("继续操作", { disabled: true, iconName: "lock", title: `${item.title}：当前必须 fail closed` })}</article>`).join("")}</div></section>
    <section class="qa-section" aria-labelledby="publication-states-heading"><div class="section-heading"><h2 id="publication-states-heading">发布项恢复与终态</h2><p>阻断、等待重试、拒绝、失败和取消不能被同一个“失败”标签吞并。</p></div><div class="edge-states-grid">${publicationCards}</div></section>`;
}

function notFound(): string {
  return emptyState("页面不存在", "该本地 fixture 路由没有实现；请从主导航返回工作台。") + `<div class="center-actions">${button("返回工作台", { route: "/app", variant: "primary" })}</div>`;
}

export const routes: Record<string, RouteDefinition> = {
  "/app": { label: "工作台", title: "工作台", render: dashboard },
  "/app/works": { label: "内容", title: "内容", render: worksList },
  [`/app/works/${work.id}/edit`]: { label: "内容编辑", title: "内容编辑", render: editor },
  [`/app/works/${work.id}/variants`]: { label: "平台变体", title: "平台变体", render: variantsPage },
  [`/app/works/${work.id}/preview`]: { label: "预览", title: "预览", render: editor },
  "/app/batches/new": { label: "发布批次", title: "新建发布批次", render: batchNew },
  [`/app/batches/${batch.id}/review`]: { label: "审批", title: "批次审批", render: review },
  [`/app/batches/${batch.id}`]: { label: "任务与结果", title: "批次结果", render: batchResult },
  "/app/batches/batch-20260718-03": { label: "任务与结果", title: "批次结果", render: batchResult },
  "/app/accounts": { label: "账号与能力", title: "账号与能力", render: accountsPage },
  "/app/audit": { label: "审计与证据", title: "审计与证据", render: auditPage },
  "/app/settings/edge": { label: "设置与 Edge", title: "设置与 Edge", render: edgePage },
  "/app/qa/edge-cases": { label: "QA 敌意状态", title: "QA 敌意状态", render: edgeCasesPage }
};

export function resolveRoute(pathname: string): RouteDefinition {
  return routes[pathname] ?? { label: "未找到", title: "页面不存在", render: notFound };
}
