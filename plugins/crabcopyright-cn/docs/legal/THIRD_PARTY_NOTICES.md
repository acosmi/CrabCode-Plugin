# Third-Party Notices

`crabcopyright-cn` 的确定性源码材料 bundle 包含或派生自以下 Apache-2.0 上游核心：

- CodeSucker v0.4.5, Copyright 2026 fanbuz
- Repository: <https://github.com/fanbuz/codesucker>
- Locked commit: `2e39375cf6891b9d958c277f1c6eb3b5104814d9`

适用许可和 NOTICE：

- [`LICENSE-CodeSucker.txt`](./LICENSE-CodeSucker.txt)
- [`upstream-NOTICE.txt`](./upstream-NOTICE.txt)
- [`upstream-THIRD_PARTY_NOTICES.txt`](./upstream-THIRD_PARTY_NOTICES.txt)

本插件只移植 `packages/core/src`，并在本地适配层中打包其运行依赖：

- `chardet`
- `docx`
- `fast-glob`
- `iconv-lite`
- `ignore`
- `jszip`
- 上述包在锁文件中的传递依赖

精确安装版本以插件根 `bun.lock` 为准。发布门会检查锁文件、bundle 新鲜度、SOURCE-LOCK 和本通知同时存在；依赖变化时必须重新核对许可证，不得只更新 `package.json`。

本地适配文件由 CrabCode 项目维护，整体仍按插件清单所示 Apache-2.0 分发；上游名称仅用于来源说明，不表示 fanbuz 或 CodeSucker 对本插件提供赞助、合作或背书。
