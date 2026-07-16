# editorial-white@1

`tokens.json` 是浏览器预览、发布包和微信富文本档案的唯一设计令牌源。

- 所有基础表面固定为 `#FFFFFF`；
- 只使用系统中文字体，不加载远程字体；
- 层级依赖字号、字重、留白、边线和单一强调色；
- 暗色系统偏好不会把文章切换为深色，但不禁用操作系统高对比度模式。

适用档案：完整 `web@1`、内联样式 `wechat-richtext@1` 与 `@media print`；Markdown 只备份语义，不承诺视觉样式。

确定性交付检查覆盖：恰好一个 H1、H2–H4 不跳级、无 raw HTML/脚本/远程资源、全部图片来自冻结包内路径、HTML/Markdown 同源和字节哈希不变。自动 QA 使用固定 Nu、Playwright/Chromium 与 axe，在 320/375/768/1440 的浅色和深色偏好下检查白底、整页横向溢出、隐藏裁切文本、axe violation/incomplete；另做 375 文本间距、200% 字号、打印白底以及 A4/Letter PDF 检查，并保存哈希绑定的报告、整页截图和 PDF。

发布夹具还在 320-light、375-light、375-dark、768-light、1440-light 上执行当前操作系统专属的零像素差 golden 截图回归。自动规则不能判断全部认知可读性，因此可信视觉复核人和覆盖移动/桌面/宽屏/打印的确认仍须写入 DeliveryManifest 后才能审批；不得把 Nu/axe 通过描述为完整 WCAG 认证。
