# 微信草稿渠道验收清单（0.4.0 / R-B 可选）

> 本清单由**真人**在真实浏览器中完成。Agent 不得登录 `mp.weixin.qq.com`、不得绕过浏览器安全策略、不得伪造草稿截图冒充渠道验收。

## 前置（可由 agent 准备）

- [ ] 本地已生成并哈希绑定：`article.html`、`article.md`、`wechat-richtext.html`
- [ ] 记录 `deliveryId`、`primaryArtifact.artifactHash`、`channelArtifacts[0].artifactHash`
- [ ] 打开本地 `wechat-richtext.html` 确认标题/正文/图注/披露可见

## 人机步骤（必须真人）

1. 使用**本机系统浏览器**（非 agent 控制）登录公众号后台  
2. 新建草稿，将 `wechat-richtext.html` 中可用片段粘贴/导入编辑器  
3. 记录观察：

| 项 | 现象 | pass/fail |
|----|------|-----------|
| 被清洗的标签/样式 | | |
| 本地图片是否仍在 | | |
| 多余空行/段落 | | |
| 标题层级是否异常 | | |
| AI 披露是否可见 | | |

4. 截图归档，文件名建议：`wechat-draft-{deliveryId}-{YYYYMMDD}.png`  
5. 与本地 HTML sha256 一并放入发布证据目录  

## 签字

| 字段 | 内容 |
|------|------|
| 操作者 | |
| 时间（ISO-8601） | |
| deliveryId | |
| primary HTML sha256 | |
| channel HTML sha256 | |
| 结论 | pass / fail |
| 备注 | |

## 发布口径

- **R-A（默认）**：正式 `0.4.0` = 插件 + 自动 QA + 安装/源码门禁绿；本清单为推荐人机 Gate B。  
- **R-B**：若本窗口完成签字，可将截图与清单附在 release notes。  
- **R-C（禁止）**：agent 自动登录微信并建草稿。
