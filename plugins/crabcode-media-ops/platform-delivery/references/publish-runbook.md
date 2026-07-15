# 人工发布包运行手册

1. 最终稿通过工具生成的研究、原创和 editorial review 单步晋升 reviewed。
2. `mediaops.delivery.render` 冻结素材字节，从同一 ArticleDoc 生成精排白底 `article.html`（主）、`article.md`（备份）和平台档案。
3. 实际检查 320/375 附近移动端、768 桌面/平板、1200+ 宽屏、打印、白底、可读性和横向溢出，再调用 `mediaops.delivery.verify`；preview 只复用该 HTML。
4. readiness 复核事实、原创、法律、披露、profile、素材权利、规则时效、交付清单和真实产物字节。
5. request 同时绑定 content、ArticleDoc、DeliveryManifest、HTML/Markdown/平台产物哈希；向批准者展示确切 HTML。批准者必须与请求者不同。
6. approved 后 package 只复制冻结候选并校验复制前后字节，不重渲染、不回读原素材。包内默认打开 `article.html`，`article.md` 仅作备份。
7. 人工在平台后台再次核对动态规则、原生 AI 标识和素材后完成发布。

真平台 API、浏览器最终点击和自动评论属于 Gate B。不得伪造发布成功。

`delivery.verify` 自动复验冻结字节、重新渲染一致性、离线 CSP、单一 H1、白底 token 和主/备角色；`verifiedBy` 提交的视口、打印、白底与可读性是具名验收证据，不代表运行时自动启动浏览器、axe 或完成 WCAG 认证。Gate A 不认证 reviewer 的真实身份，跨人审批须由 Gate B 宿主 principal/role 保障。
