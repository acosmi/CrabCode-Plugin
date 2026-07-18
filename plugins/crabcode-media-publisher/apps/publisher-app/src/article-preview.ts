export const articlePreviewDocument = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; base-uri 'none'; form-action 'none'">
    <meta name="color-scheme" content="light">
    <title>多平台分发，不该只是把同一篇文章复制八遍</title>
    <style>
      :root { color-scheme: light; background: #fff; }
      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; background: #fff !important; color: #0f172a; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif; }
      article { width: min(704px, calc(100% - 40px)); margin: 0 auto; padding: 52px 0 72px; background: #fff; }
      .eyebrow { margin: 0 0 16px; color: #1769e0; font-size: 13px; font-weight: 650; letter-spacing: .08em; }
      h1 { margin: 0 0 18px; font-size: clamp(27px, 4vw, 36px); line-height: 1.24; letter-spacing: -.025em; }
      .dek { margin: 0 0 28px; color: #475569; font-size: 18px; line-height: 1.7; }
      .meta { display: flex; flex-wrap: wrap; gap: 8px 16px; margin: 0 0 26px; padding: 14px 16px; border-radius: 12px; background: #f8fafc; color: #475569; font-size: 13px; }
      h2 { margin: 2em 0 .7em; font-size: 24px; line-height: 1.42; letter-spacing: -.015em; }
      p, li { font-size: 17px; line-height: 1.76; }
      p { margin: 1.05em 0; }
      blockquote { margin: 1.6em 0; padding: 16px 20px; border-radius: 12px; background: #eff6ff; color: #334155; }
      .note { margin-top: 32px; padding: 18px 20px; border-radius: 12px; background: #f8fafc; font-size: 14px; line-height: 1.65; }
      @media (max-width: 520px) { article { width: calc(100% - 32px); padding-top: 32px; } p, li { font-size: 16px; } }
      @media print { article { width: 100%; padding: 0; } h1, h2 { break-after: avoid; } }
    </style>
  </head>
  <body>
    <article>
      <p class="eyebrow">内容基础稿 · rev-017</p>
      <h1>多平台分发，不该只是把同一篇文章复制八遍</h1>
      <p class="dek">真正可靠的“一键发布”，不是减少一次点击，而是让每个平台收到适合它、又能追溯到同一事实源的内容。</p>
      <div class="meta"><span>作者：傅**</span><span>8 个可核验来源</span><span>AI 辅助整理已披露</span></div>
      <p>内容团队很容易把“自动化”理解成复制：同一篇长文，换个标题，依次贴进公众号、微博、头条和百家号。表面上省了时间，实际却把平台差异、账号风险和结果核验都推给了最后一次点击。</p>
      <h2>一个事实源，多个真正独立的发布项</h2>
      <p>Hub 先冻结内容 revision，再为“平台账号 + 内容类型”生成独立变体。普通微博与微博长博文不是同一个任务；头条文章和微头条也不能只靠截断字符来区分。</p>
      <blockquote>一键的含义，是一次批准多个已预览的独立发布项，而不是跳过预览与审批。</blockquote>
      <h2>成功必须有远端证据</h2>
      <p>按钮被点击，只能证明自动化走到了某一步。只有平台返回 ID、公开 URL、草稿回读或审核状态能够被核验时，界面才把结果标记为对应状态。结果未知时，系统先对账，而不是盲目重发。</p>
      <div class="note"><strong>信息披露：</strong>本文由 AI 辅助整理结构；事实核验、观点判断和最终编辑由作者完成。HTML 是默认阅读交付，Markdown 为同 revision 备份。</div>
    </article>
  </body>
</html>`;

export const articlePreviewMarkdown = `# 多平台分发，不该只是把同一篇文章复制八遍

真正可靠的“一键发布”，不是减少一次点击，而是让每个平台收到适合它、又能追溯到同一事实源的内容。

作者：傅**
来源：8 个可核验来源
披露：AI 辅助整理已披露

内容团队很容易把“自动化”理解成复制：同一篇长文，换个标题，依次贴进公众号、微博、头条和百家号。表面上省了时间，实际却把平台差异、账号风险和结果核验都推给了最后一次点击。

## 一个事实源，多个真正独立的发布项

Hub 先冻结内容 revision，再为“平台账号 + 内容类型”生成独立变体。普通微博与微博长博文不是同一个任务；头条文章和微头条也不能只靠截断字符来区分。

> 一键的含义，是一次批准多个已预览的独立发布项，而不是跳过预览与审批。

## 成功必须有远端证据

按钮被点击，只能证明自动化走到了某一步。只有平台返回 ID、公开 URL、草稿回读或审核状态能够被核验时，界面才把结果标记为对应状态。结果未知时，系统先对账，而不是盲目重发。

**信息披露：** 本文由 AI 辅助整理结构；事实核验、观点判断和最终编辑由作者完成。HTML 是默认阅读交付，Markdown 为同 revision 备份。
`;
