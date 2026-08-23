# 旧版本→安全版本重启 fixture 证据边界

本 fixture 是 `P1-UPGRADE-01` 的插件仓可复现证据，运行命令：

```bash
bun run test:mcp-upgrade-fixture
```

它不读取工作区快照，而是分别对下面两个真实 Git commit 执行 `git archive --format=tar`，再解包到隔离临时目录：

- registry generation 1：公网 `latest` 曾实际指向的旧提交 `2e0b1266dcc4c34f8930cd589ce7aaedd6aa0f10`；
- registry generation 2：测试时的 `HEAD`，因此完整整改必须先提交，fixture 才能通过。

这里的 generation 仅指现有 marketplace registry 的单调安装代次，不是尚未发布的 CrabCode auth/runtime “host generation 2”；本 fixture 不得作为后者已实现或已测试的证据。

验证过程使用共享 registry 与两个真正的操作系统子进程。进程 A 在 generation 1 启动并冻结旧安装路径；registry 原子切换到 generation 2 且把旧路径标记为 orphan 后，A 虽能看见 registry 已更新，仍从冻结路径枚举出 HTTP/SSE remote MCP。A 仍存活时启动进程 B；B 重新读取 registry，只激活 generation 2，并验证 published plugin root 中只有 `crabcode-html-video/.mcp.json`、本地 stdio=1、HTTP=0、SSE=0，同时旧字节仍只以 orphan 存在。临时目录无论成功或失败都由 `finally` 清理。

证据口径必须保持准确：这是“真实 Git bytes + 双进程 generation 生命周期模型”，会枚举 plugin-root `.mcp.json`、manifest/marketplace `mcpServers` 及其外部 JSON/MCPB/DXT 引用，但不会导入或执行 CrabCode host 源码，也不会启动任何 MCP server 或访问其 endpoint。它应与 CrabCode host 已有的 57 项 plugin/MCP 单元测试组合阅读；在宿主交付 targeted MCP eviction 前，面向用户的止血动作仍是“升级插件并重启 CrabCode”，不得把本 fixture 描述成宿主热更新测试。

手动 API CI 的 root verify job 使用 `fetch-depth: 0`，确保旧提交对象存在；fixture 本身不联网，也不依赖本机 CrabCode 仓绝对路径，可在 macOS/Linux 运行。
