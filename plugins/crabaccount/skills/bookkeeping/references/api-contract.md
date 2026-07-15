# CrabAccount API 合同（v0.1）

本表来自固定上游适配器的请求形状与 CrabAccount 合成测试，不是服务端 OpenAPI。`doctor` 只对用户目标服务做只读响应探针；写操作仍需预览、确认和写后核对。

## 兼容闸门

- API base = 规范化 base URL + 单个 `/api`。
- 只接受 release `2.7.x`，并要求版本、账户、分类、动作四个只读响应形状通过。
- base URL 改变会清除 Token 和兼容记录。
- 未通过闸门时，写命令返回 `COMPATIBILITY_REQUIRED`，不发写请求。

## 端点矩阵

| 能力 | Method / path | 请求/响应证据 | v0.1 状态 |
|---|---|---|---|
| 登录 | `POST /auth/login` | `{username,password:<md5>}` → `.data.token` | 固定适配器已观察；用户终端隐藏输入 |
| 版本 | `GET /home/getVersion` | `.data.versions.release`、`.data.auth` | doctor 实例探针 |
| 账户 | `GET /account/getAccount` | `.data[]`，账户名字段 `name` | doctor 实例探针 |
| 分类 | `GET /type/getType` | `.data[]`，分类名 `tname`，动作在 `.action` | doctor 实例探针 |
| 动作 | `GET /action/getAction` | `.data[]`，`id/handle/hname` | doctor 实例探针 |
| 年度统计 | `GET /home/getHomeInfoV2/{year}` | `.data` | 固定适配器已观察；只读 |
| 流水查询 | `POST /screen/getFlowByScreen` | 筛选 JSON → `.data.flows/totalIn/totalOut/totalEarn` | 固定适配器已观察；语义只读 |
| 流水详情 | `GET /flow/getFlow/{id}` | `.data` 嵌套 `account/type/action` | 固定适配器已观察；更新前置 |
| 新增/转账 | `POST /flow/addFlow` | 账户、分类、动作、金额、日期、备注、collect、createDate；转账加 accountToId | 固定适配器已观察；写后按 `.data.id` 核对 |
| 更新 | `PUT /flow/updateFlow/{id}` | 保守按全量 payload；保留原 `createDate` 和未修改字段 | 固定适配器已观察；写前后读取核对 |
| 服务端导出 | `POST /screen/makeExcel?excelName=...` | 查询 payload → `.data.success/.data.log` | 固定适配器已观察；只报告服务端产物 |

## 确认与错误语义

- HTTP 200/201、合法 JSON、业务 `code` 为 0 才进入成功候选。
- 4xx 且响应可解析为明确业务拒绝 → `confirmed_failed`。
- 写请求的 curl 传输错误、HTTP 5xx、空/非 JSON 响应、成功响应缺少新增 ID或写后读取不一致 → `commit_unknown`。
- 只读请求对 curl 传输错误及 429/502/503/504 最多重试三次；写请求不自动重试。
- 401/418 会使本地 Token 失效。只读命令停止并要求重新登录；写命令绝不自动登录后重放。

## 明确没有承诺的能力

- 删除、自动回滚、服务端事务批量、稳定幂等键或 external ID；
- 全量分页、全库查重、跨币种换算；
- 可直接下载的导出 URL；
- `from` 来源字段或自动品牌备注；
- 自动创建账户、分类或动作。
