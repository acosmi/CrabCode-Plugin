# Third-Party Notices

## EasyAccounts-Skills

- Source: `https://github.com/QingHeYang/EasyAccounts-Skills`
- Fixed commit: `fcc9300a070bd89a13c3d4b4df79a0274db17dd2`
- Accessed: 2026-07-15
- License: MIT-0; exact copy at `licenses/EasyAccounts-Skills-MIT-0.txt`

CrabAccount 参考并重写了该固定提交中账户、分类、动作、流水查询、新增、更新、转账、年度统计、服务端导出和登录协议的请求形状。没有复制其用户人格、品牌文案、配置目录、来源标签或不安全的凭据处理。

主要本地修改包括：

- 统一为 CrabAccount 命名和 CrabCode 插件/技能结构；
- 把多个公共脚本收敛为一个 CLI 与私有库；
- 密码从 argv 和对话中移除，Token 从 curl 进程参数中移除；
- 增加 HTTPS/URL、文件权限、原子写和符号链接防护；
- 写操作增加预览、digest、确认、写后核对和最小 journal；
- 顺序批量明确为非原子，并区分 `success`、`confirmed_failed` 和 `commit_unknown`；
- 移除自动品牌备注和 `from` 标记。

## EasyAccounts deployment repository

- Source: `https://github.com/QingHeYang/EasyAccounts`
- Fixed commit: `49eabb784ad718fb1efd4014f569b51948a2b628`
- Accessed: 2026-07-15

该仓固定提交用于核对部署版本和“服务端为外部自托管组件”的边界。CrabAccount 不包含、不重打包、不改名也不分发其容器镜像。

## Design references only

Actual Budget、Firefly III Data Importer、GnuCash、Beancount/Beangulp、Paisa、Blnk、Maybe、Stripe、Modern Treasury 和 OWASP CSV Injection 仅用于设计研究。CrabAccount 未复制这些项目的源码、测试数据、文案或资源；其许可证不因“设计参考”而并入本插件。
