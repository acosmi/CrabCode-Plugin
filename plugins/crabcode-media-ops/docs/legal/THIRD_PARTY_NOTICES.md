# Third-Party Notices

本插件（`crabcode-media-ops`）为**原创实现**。在设计阶段，曾**参考**（仅参考公开设计与交互思路，**未复制任何源代码**）以下开源/公开项目。本插件不内嵌、不分发上述任何项目的代码或受版权保护的素材。

## 参考项目（仅参考公开设计，未复制代码）

| 项目 | 许可证 | 参考与处置说明 |
|---|---|---|
| md2wechat-skill | BUSL-1.1 | 仅参考 Markdown → 公众号排版的公开设计思路；未复制代码；BUSL 限制下不复用其受限源码。 |
| baoyu-post-to-wechat | 无 LICENSE（保留所有权利） | 无开源许可即视为保留所有权利；仅参考其公开交互流程的概念，未复制任何代码或资源。 |
| postiz | AGPL-3.0 | 仅了解其多平台发布的产品形态；AGPL 传染性强，**绝不复用其代码**，本插件无任何来自该项目的代码。 |
| PostAll | MIT | 仅参考多平台发布编排的公开设计；未直接复制代码。 |
| xiaohongshu-skill | MIT | 仅参考小红书图文适配的公开设计；其上游依赖 `xiaohongshu-mcp` 的许可与集成另行核验后再决定是否接入（当前未接入）。 |
| html-anything | Apache-2.0 | 仅参考 HTML 渲染/预览的公开设计；未直接复制代码。 |

## 本插件许可证
- `crabcode-media-ops`：Apache-2.0，CrabCode。

## 随插件分发的运行时依赖

| 依赖 | 许可证 | 用途 |
|---|---|---|
| `@modelcontextprotocol/sdk` | MIT | MCP 服务协议与 stdio 传输。 |
| `zod` | MIT | 运行时输入与存储记录校验。 |
| `unified`、`remark-parse`、`remark-stringify`、`remark-gfm`、`remark-rehype` | MIT | Markdown 解析、规范化 ArticleDoc 与 HAST 转换。 |
| `rehype-sanitize`、`rehype-stringify` | MIT | HAST 白名单净化与确定性 HTML 序列化。 |
| `hono`（SDK 间接依赖，锁定 4.12.25） | MIT | SDK 间接 HTTP 运行时；通过 override 固定已修复版本。 |

完整锁定组件见 `SBOM.cdx.json`（CycloneDX 1.5）；完整许可证文本仍以上游 LICENSE 为准。`bun run validate` 会阻断 SBOM 与 `bun.lock`、直接依赖或 Hono 安全固定版本漂移。

## 说明
- "参考"指阅读公开文档/README/交互形态以获取设计灵感，**不等于复制源代码**。
- 若后续需要直接集成上述任一项目的代码或上游服务（如 `xiaohongshu-mcp`），须先单独核验其许可证兼容性与合规要求，再行接入。
