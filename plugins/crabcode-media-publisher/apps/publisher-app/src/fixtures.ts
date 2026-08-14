export const demoClock = "2026-07-18 14:20 CST";

export const workspace = {
  name: "Acosmi 内容工作室",
  role: "运营管理员",
  identity: "傅**",
  edge: "online" as const
};

export const work = {
  id: "work-8F2C",
  title: "多平台分发，不该只是把同一篇文章复制八遍",
  summary: "从内容事实源、平台变体到可核验结果，重新定义真正安全的一键分发。",
  author: "傅**",
  revision: "rev-017",
  frozenAt: "2026-07-18 13:42 CST",
  wordCount: 2864,
  sourceCount: 8,
  disclosure: "AI 辅助整理；观点、核验与最终编辑由作者完成",
  hash: "sha256:4b1c…9a72"
};

export const dashboardMetrics = [
  { label: "待继续编辑", value: "3", detail: "1 篇存在来源缺口", tone: "neutral" },
  { label: "待强身份审批", value: "2", detail: "共 9 个发布项", tone: "primary" },
  { label: "执行与审核中", value: "6", detail: "最后对账于 14:18", tone: "success" },
  { label: "需要人工处理", value: "2", detail: "Edge 登录与未知结果", tone: "warning" }
] as const;

export const attentionItems = [
  {
    title: "今日头条 · 文章与微头条相似度过高",
    detail: "同一账号的两个体裁相似度为 91%，已阻止进入审批。",
    meta: "work-8F2C · 8 分钟前",
    status: "blocked" as const,
    route: "/app/works/work-8F2C/variants"
  },
  {
    title: "微博长博文需要在 Edge 设备确认登录",
    detail: "Mac Studio ••••92AF 在线，但微博会话需要账号本人确认。",
    meta: "batch-20260718-04 · 12 分钟前",
    status: "action_required" as const,
    route: "/app/batches/batch-20260718-04"
  },
  {
    title: "百家号结果未知，必须先对账",
    detail: "提交后未取得远端作品 ID；系统已禁止盲目重发。",
    meta: "batch-20260718-03 · 27 分钟前",
    status: "unknown" as const,
    route: "/app/batches/batch-20260718-03"
  }
] as const;

export const variants = [
  { id: "weibo-status", platform: "微博", account: "Acosmi 科技", type: "普通微博", capability: "verified" as const, status: "remote_draft" as const, chars: "238 / 2000", risk: "低" },
  { id: "weibo-long", platform: "微博", account: "Acosmi 科技", type: "长博文", capability: "verified" as const, status: "waiting_for_edge" as const, chars: "2,684", risk: "中" },
  { id: "toutiao-article", platform: "今日头条", account: "Acosmi 观察", type: "文章", capability: "verified" as const, status: "prepared_local" as const, chars: "2,731", risk: "高" },
  { id: "toutiao-micro", platform: "今日头条", account: "Acosmi 观察", type: "微头条", capability: "verified" as const, status: "blocked" as const, chars: "412", risk: "阻断" },
  { id: "dayu-article", platform: "大鱼号", account: "Acosmi 数字生活", type: "文章", capability: "stale" as const, status: "blocked" as const, chars: "2,705", risk: "能力过期" },
  { id: "jianshu-article", platform: "简书", account: "Acosmi", type: "文章", capability: "unverified" as const, status: "remote_draft" as const, chars: "2,644", risk: "最终发布未验证" }
] as const;

export const batch = {
  id: "batch-20260718-04",
  revision: "batch-rev-003",
  phase: "terminal" as const,
  outcome: "partial" as const,
  approval: "stale_approval" as const,
  targetHash: "sha256:7de8…c105",
  previewHash: "sha256:ba9e…12fc",
  approver: "林** · 内容负责人",
  approvedAt: "2026-07-18 13:56 CST",
  scheduledFor: "立即执行 · Asia/Shanghai",
  items: [
    { platform: "微博", account: "Acosmi 科技 · wb_••91", type: "普通微博", action: "立即发布", state: "published" as const, observedAt: "14:02", evidence: "weibo.com/•••/Pq9 · 已脱敏" },
    { platform: "微博", account: "Acosmi 科技 · wb_••91", type: "长博文", action: "保存草稿", state: "action_required" as const, observedAt: "14:08", evidence: "Mac Studio ••••92AF 需确认登录" },
    { platform: "今日头条", account: "Acosmi 观察 · tt_••27", type: "文章", action: "立即发布", state: "under_review" as const, observedAt: "14:18", evidence: "item_id tt•••804 · 平台审核中" },
    { platform: "百家号", account: "Acosmi 观察 · bj_••14", type: "文章", action: "立即发布", state: "unknown" as const, observedAt: "14:06", evidence: "未取得远端 ID · 禁止重发" },
    { platform: "简书", account: "Acosmi · js_••42", type: "文章", action: "保存草稿", state: "remote_draft" as const, observedAt: "14:03", evidence: "draft/•••/c72 · 已回读标题" }
  ]
};

export const accounts = [
  {
    platform: "微博",
    account: "Acosmi 科技 · wb_••91",
    edge: "Mac Studio ••••92AF",
    verifiedAt: "2026-07-18 12:20 CST",
    capabilities: [
      { type: "普通微博", action: "发布、图片", state: "verified" as const },
      { type: "长博文", action: "保存草稿、人工确认", state: "verified" as const },
      { type: "视频微博", action: "网页助手", state: "stale" as const }
    ]
  },
  {
    platform: "今日头条",
    account: "Acosmi 观察 · tt_••27",
    edge: "Mac Studio ••••92AF",
    verifiedAt: "2026-07-18 12:23 CST",
    capabilities: [
      { type: "文章", action: "预填、人工确认", state: "verified" as const },
      { type: "微头条", action: "预填、人工确认", state: "verified" as const },
      { type: "小视频", action: "OpenAPI 提交", state: "unverified" as const },
      { type: "中视频", action: "实验性网页助手", state: "disabled" as const }
    ]
  },
  {
    platform: "大鱼号 / UC",
    account: "Acosmi 数字生活 · dy_••63",
    edge: "MacBook Pro ••••114C",
    verifiedAt: "2026-07-11 09:10 CST",
    capabilities: [
      { type: "文章", action: "网页助手", state: "stale" as const },
      { type: "视频", action: "网页助手", state: "stale" as const },
      { type: "UC 下游分发", action: "结果观察，不创建第二任务", state: "verified" as const }
    ]
  },
  {
    platform: "简书",
    account: "Acosmi · js_••42",
    edge: "Mac Studio ••••92AF",
    verifiedAt: "未完成最终发布验证",
    capabilities: [
      { type: "文章草稿", action: "保存并回读", state: "verified" as const },
      { type: "文章发布", action: "仅人工确认", state: "unverified" as const }
    ]
  }
] as const;

export const auditEvents = [
  { time: "14:18:42", actor: "Edge ••••92AF", event: "回读平台审核状态", object: "toutiao.article / tt•••804", evidence: "ev_92ad…17c0", dimension: "publication" as const, result: "under_review" as const },
  { time: "14:08:17", actor: "Edge ••••92AF", event: "暂停等待账号确认", object: "weibo.long_article", evidence: "ev_70b1…8f23", dimension: "publication" as const, result: "action_required" as const },
  { time: "14:06:03", actor: "Hub executor", event: "标记远端结果未知", object: "baijiahao.article", evidence: "ev_41cd…601e", dimension: "publication" as const, result: "unknown" as const },
  { time: "13:56:11", actor: "林**", event: "强身份批准目标集合", object: "batch-rev-003", evidence: "approval_9f2a…c021", dimension: "approval" as const, result: "approved" as const },
  { time: "13:55:42", actor: "傅**", event: "冻结发布预览", object: "preview ba9e…12fc", evidence: "ev_330a…91bf", dimension: "revision" as const, result: "frozen" as const }
] as const;
