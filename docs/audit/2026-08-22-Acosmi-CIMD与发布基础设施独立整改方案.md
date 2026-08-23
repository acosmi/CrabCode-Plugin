# Acosmi CIMD 与发布基础设施独立整改方案

> **2026-08-23 整改修订**：Acosmi R/A/B 源码已合入，但生产门仍为 `blocked/release-infrastructure-unavailable`；公网 CIMD 仍 404，两份 AS metadata 仍广告未实现能力。本修订不改已合入的六字段 JSON，但将它降为“候选 provider 策略”；任何 remote 解锁仍需 MCP `2026-07-28` RFC 9207 `iss`、RFC 8707 `resource`、S256 与逐 provider E2E。发布依赖正式拆为 `ACOSMI-REL-BASE`、`P0-0A-BOOTSTRAP`、`GENESIS-INTEGRATION`，本文中任何旧命名或反向依赖均不再有效。插件分发只使用真实 `plugins/crabcode-plugins-official/latest + <sha>.zip + .sha256` 合同，不创建第二套 marketplace pointer。
>
> 日期：2026-08-22（America/Los_Angeles）
>
> 合同号：`ACOSMI-MCP-P0-2026-08-22-v1`
>
> 文档角色：Acosmi-owned 实施真源
>
> 状态：历史方案已实施到 Acosmi Git main（R/A/B 源码与收口证据）；生产 `ACOSMI-REL-BASE`/P0-1 仍 `blocked/release-infrastructure-unavailable`，`P0-0A-BOOTSTRAP` 与 `GENESIS-INTEGRATION` 未实施，不得宣称公网 CIMD 或 remote 解锁完成
>
> 上位协调文档：《[插件库全仓 MCP 服务健康度根因审计与修复方案](./2026-08-22-插件库全仓MCP服务健康度-根因审计与修复方案.md)》（以下简称“主方案”）
>
> 源码基线：`/Users/fushihua/Desktop/Acosmi`，HEAD `c2a54e80fc98f15626a90caa26b3e8d1eda709ca`
>
> 生产基线：`root@59.110.139.37`，后端制品 `c0af25ab2aa4c285a5c4869d9ff48fda6a9849af`，构建时间 `2026-08-19T04:38:16Z`

> **协调修订（2026-08-22，2026-08-23 校正）**：全局固定 `3118` 已否决；`http://127.0.0.1/callback` + OS-assigned 实际端口是候选默认，仅在逐 provider 证明 RFC 8252 port exception 后可用。`P0-0A-BOOTSTRAP` 只阻断 `GENESIS-INTEGRATION`/remote-capable 解锁，不阻断插件仓 remote=0 止血或只受 `ACOSMI-REL-BASE` 约束的 A→B。后文不再使用“冲突时看页首”作为机器解析规则；三个 gate 必须逐条无冲突。

SSH 凭据继续使用用户指定的本地私钥文件；私钥路径、内容、指纹和可恢复参数不得写入仓库、制品、命令输出或审计证据。

## 0. 最终裁决与权威边界

本文档将 Acosmi 相关工作固定拆成三个独立工作包：

| 工作包 | 内容 | 责任仓/系统 | 是否源码改动 |
| --- | --- | --- | --- |
| `ACOSMI-SRC-P0-1` | 删除两份 AS metadata 虚假广告，新增 CrabCode CIMD 公共路由及测试 | `Acosmi/nexus-v4/backend` | 是 |
| `ACOSMI-REL-BASE` | backend bundle primary/DR、四个 protected environment、OIDC、fixture、A/B 部署与回滚 | Acosmi Release/生产 | 是发布自动化与外部资源；只阻断 A/B |
| `P0-0A-BOOTSTRAP` | public lock/evidence 跨云 DR、WORM、2-of-3 key/HMAC/offline-root 和 bootstrap canary | Acosmi Ops/Release | 否；只阻断未来 trust path |
| `GENESIS-INTEGRATION` | bootstrap + safe artifacts + 必要 backend record 均通过后组合/签名/发布首份 lock | 跨仓 release | 否；不可反向成 bootstrap 前置 |

权威分工固定为：

1. Acosmi 后端文件、测试、两段制品、部署、回滚与 `ACOSMI-REL-BASE`/`P0-0A-BOOTSTRAP` 证据以本文档为实施真源；两个 gate 不得互相代答。
2. canonical client ID URL、callback、CIMD JSON、跨仓阻断关系、全局 release-lock schema 和联合解锁顺序以主方案为协调真源。
3. 两份文档中任一交接合同字段变更，必须使用同一变更同步修订两文档；只修一处即验收失败。
4. 三个工作包使用独立任务、工作树、评审和发布记录；不与 `CrabCode-Plugin` 或 `CrabCode` 改动合并为一个实施任务。
5. P0-1 通过只代表 Acosmi 交付闭环，不代表 17 条历史声明/候选映射已生成 generation=2 binding，更不代表它们可发布；联合解锁仍受主方案门禁约束。

## 1. 已证明的当前状态

### 1.1 生产运行态与责任层

2026-08-22 只读实测结果：

```text
nginx       = active
nexus       = active
tkdist-java = active

public GET  https://acosmi.com/oauth/crabcode-client-metadata = 404 text/plain
local Host  /oauth/crabcode-client-metadata                   = 404 text/plain
```

生效 Nginx 配置已有：

```nginx
location /oauth/ {
    proxy_pass http://127.0.0.1:8009;
}
```

因此根因已固定为 Go backend 没有 GET handler；不改 DNS、TLS 或 Nginx exact location。如实施变更包出现 Nginx 差异，必须 hard fail 并从本工作包移除。

### 1.2 Acosmi AS metadata 虚假广告

普通 metadata 与 desktop metadata 现在都输出：

```json
"client_id_metadata_document_supported": true
```

实际行为却是：

- `pkg/mcp/oauth_server.go` 的 `AuthorizationServer.Authorize` 对未注册 HTTPS client ID 仍返回 `invalid_client`；
- `internal/handler/desktop_oauth.go` 的 authorize 路径也只接受已注册 client；
- `FetchClientIDMetadata` 和 `DetermineClientRegistration` 没有生产调用链。

“Acosmi 托管 CrabCode 的客户端 metadata”与“Acosmi AS 自身支持 URL client ID”是两件事。本工作包实现前者，并删除后者的虚假广告；不实现后者。

### 1.3 现有 admin MCP OAuth handler 禁止复用

下列现有路由继续保持隔离：

```text
POST /api/v4/plugins/mcp/oauth/authorize
GET  /api/v4/plugins/mcp/oauth/callback
```

它们需要 owner/admin JWT，依赖未注入的 Gin context 值，state 可预测，token Redis key 没有 user/tenant/provider/resource 隔离，且 refresh token 会随 access token 记录一起删除。本工作包不修补、不扩建、不把它们作为 CrabCode OAuth broker。

## 2. `ACOSMI-SRC-P0-1`：后端源码实施合同

### 2.1 两个独立 commit 与两份可回滚制品

实施链从审计基线开始固定为三个直接父子 commit：

```text
BASE = c2a54e80fc98f15626a90caa26b3e8d1eda709ca
R.parent    = BASE
A.parent    = R
B.parent    = A
```

R 是第 3.2 节的发布自动化 commit，只允许修改：

```text
.github/workflows/deploy-cn-nexus-backend.yml
nexus-v4/backend/Dockerfile
nexus-v4/infra/systemd/nexus-backend.service
```

A/B 在同一 Acosmi 源码评审中按下列顺序产生，并分别构建不可变制品：

1. A=`metadata-safe`：只删除两处虚假 CIMD 能力广告并增加 metadata 测试。
2. B=`cimd-enabled`：以 A 为父 commit，新增 CrabCode client metadata handler、路由和测试。

三个 direct-parent 断言任一失败即停止；禁止在 BASE→R→A→B 中间夹入任何其他 commit。A/B 不夹带格式化、依赖升级、admin OAuth handler、Nginx 或其他业务改动。A 和 B 均必须单独通过后端全量测试与构建。如实施前 Acosmi `main` 已不再以 BASE 为线性起点，禁止自动 rebase/夹带新改动；必须先重做只读基线审计并同步更新两份合同文档。

### 2.2 制品 A：删除虚假 AS metadata 能力

修改文件与唯一允许的业务改动：

| 文件 | 固定改动 |
| --- | --- |
| `nexus-v4/backend/pkg/mcp/oauth_server.go` | 从 `AuthorizationServer.Metadata` 删除 `client_id_metadata_document_supported` key；必须是 key 缺席，不是输出 `false` |
| `nexus-v4/backend/internal/handler/desktop_oauth.go` | 从 `DesktopOAuthHandler.Metadata` 删除同名 key；必须是 key 缺席 |

保留两处 `registration_endpoint`、DCR 路由和其他已实现 metadata 字段。不接线 server-side CIMD helper，不改 authorize 对未注册 client 的处置。

新增测试文件：

```text
nexus-v4/backend/pkg/mcp/oauth_server_metadata_test.go
nexus-v4/backend/internal/handler/desktop_oauth_metadata_test.go
```

测试必须同时断言：

- HTTP 200；
- JSON key `client_id_metadata_document_supported` 缺席；
- `registration_endpoint` 仍存在且与对应 issuer 一致；
- 不允许以 `false`、`null` 或空字符串代替 key 缺席。

### 2.3 制品 B：新增 CrabCode CIMD 公共端点

新增文件：

```text
nexus-v4/backend/internal/handler/crabcode_client_metadata.go
```

固定导出无状态 Gin handler：

```go
func CrabCodeClientMetadata(c *gin.Context)
```

修改：

```text
nexus-v4/backend/cmd/api/routes_business.go
```

在 `registerOAuthASRoutes` 的公共 OAuth 路由同层注册：

```go
root.GET("/oauth/crabcode-client-metadata", handler.CrabCodeClientMetadata)
```

端点不加 JWT、session、CSRF、tenant 或用户上下文，不读请求 query/body/header 来生成字段，不发 Set-Cookie，不执行网络、数据库、Redis 或文件系统 I/O。

唯一允许的响应是以下六个 key：

```json
{
  "client_id": "https://acosmi.com/oauth/crabcode-client-metadata",
  "client_name": "CrabCode",
  "redirect_uris": [
    "http://127.0.0.1/callback"
  ],
  "grant_types": [
    "authorization_code",
    "refresh_token"
  ],
  "response_types": [
    "code"
  ],
  "token_endpoint_auth_method": "none"
}
```

上述六字段是 Acosmi 已合入的静态 source contract，不是对任意第三方 AS 的互操作保证。`http://127.0.0.1/callback` 只能在对应 AS 已证明会按 RFC 8252 忽略 loopback port 差异时与 `http://127.0.0.1:<os-assigned-port>/callback` 搭配。Notion/Linear/Canva/Synapse 需分别提交真实授权、reconnect/tools-list/canary 及同意页显示 redirect hostname/本地回调风险的证据。MCP `2026-07-28` 下游宿主还必须实现 RFC 9207 `iss` 验证、RFC 8707 `resource` 同时进 authorization/token request，以及 AS metadata 显式 `S256` 门禁。CIMD localhost-only 无法单独防止其他本地应用复用合法 client ID 冒充 CrabCode；该风险必须在 provider trust policy 中裁决，支持时评估 attestation/非对称客户端认证。`application_type=native` 是待 provider/OIDC E2E 的候选字段；本文档修订不擅自改写已合入源码的 exact key set。

HTTP 合同固定为：

| 项 | 固定值/规则 |
| --- | --- |
| Method/path | `GET /oauth/crabcode-client-metadata` |
| Status | `200` |
| Redirect | 禁止所有 3xx |
| Content-Type | `application/json; charset=utf-8` |
| Cache-Control | `public, max-age=300, must-revalidate` |
| Body | UTF-8 JSON，不超过 5120 bytes，key 集合与上述 JSON 完全相同 |
| `client_id` | 与 canonical 请求 URL 逐字符相同 |
| Secret | `client_secret`、`client_secret_expires_at` 及任何等价字段必须缺席 |

新增测试：

```text
nexus-v4/backend/internal/handler/crabcode_client_metadata_test.go
```

测试使用 `httptest` 验证 exact key set、所有 scalar/array 值、headers、状态码、无 Location、无 Set-Cookie、body size 与 secret key 缺席。

路由层新增固定测试文件：

```text
nexus-v4/backend/cmd/api/routes_business_oauth_test.go
```

该测试函数名固定为 `TestRegisterOAuthASRoutes_CrabCodeClientMetadataPublicGET`，必须通过实际 Gin engine 断言未登录 GET 命中 handler 并返回 200；POST 只允许返回 404 或 405，不得返回任何 2xx/3xx。

### 2.4 源码门禁与完成判定

禁止把 macOS/普通 runner 上的裸 `go test` 或 `go build` 作为验收证据；`cmd/api` 的 CGO 链需要七个 Linux Rust `.so`，且生产版本只能由 Docker build args 注入。

第 3.2 节的独立发布自动化 commit 必须在 `nexus-v4/backend/Dockerfile` 的 `go-builder` stage 中，完成 Rust builder 并将七库复制到 `/app/experiments/target/release` 之后、执行生产 `go build` 之前，固定执行：

```dockerfile
RUN LD_LIBRARY_PATH=/app/experiments/target/release \
    go test ./internal/handler ./pkg/mcp ./cmd/api
RUN LD_LIBRARY_PATH=/app/experiments/target/release \
    go test ./...
```

A 和 B 必须分别在 protected workflow 的 Linux Docker build 中生成两条测试通过记录；任一失败都不得生成 bundle。生产构建同时传入 40 位 `GIT_COMMIT` 和 UTC RFC3339 `BUILD_TIME`。解包后执行 `LD_LIBRARY_PATH=./lib ./server --version`，输出必须包含当次 A 或 B commit 且不含 `unknown`。

`ACOSMI-SRC-P0-1` 完成的充要条件是：A/B 两 commit 可定位，A/B 两制品均通过全量测试和构建，差异只包含本节文件，且 B 的父链包含 A。

## 3. `ACOSMI-REL-BASE`：P0-1 发布、验收与回滚

### 3.1 制品记录

A 和 B 必须分别上传 primary 与 DR：

```text
primary: oss://acosmi-private-releases-cn-hangzhou/nexus-backend/<commit>/<sha256>/nexus-backend.tar.gz
DR:      s3://acosmi-private-releases-dr-us-west-2/nexus-backend/<commit>/<sha256>/nexus-backend.tar.gz
```

`<commit>` 是 40 位 Git commit，`<sha256>` 是小写 64 位 bundle SHA-256。bundle 必须包含且只包含：

```text
server
lib/libchatacosmi_core.so
lib/libchatacosmi_crypto.so
lib/libchatacosmi_jsonschema.so
lib/libchatacosmi_mcp_v2.so
lib/libchatacosmi_ratelimit.so
lib/libchatacosmi_sandbox.so
lib/libchatacosmi_tokenizer.so
deployment-manifest.json
```

`deployment-manifest.json` 固定包含 `schemaVersion=1`、`artifactRole`、`sourceCommit`、`buildIssuedAt`以及上述八个 payload 文件（不包括 manifest 自身）的 `path/sizeBytes/sha256`。禁止从 A/B 之外的 bundle 混拼 `server` 或 `.so`。发布记录必须同时包含：

```text
artifactRole = metadata-safe | cimd-enabled
sourceCommit
buildIssuedAt
goVersion
versionOutput
sizeBytes
sha256
primaryLocator
disasterRecoveryLocator
primaryReadbackSha256
disasterRecoveryReadbackSha256
deploymentManifestSha256
safeRollbackCommit|null
safeRollbackBundleSha256|null
safeRollbackManifestSha256|null
ownerAttestation
approverAttestation
```

生产机 `/opt/acosmi/releases/...` 只是部署缓存，不是制品真源。A/B primary 和 DR 对象不得覆盖或删除。

### 3.2 发布流水线固定落点

修改现有 Acosmi 构建/发布文件：

```text
.github/workflows/deploy-cn-nexus-backend.yml
nexus-v4/backend/Dockerfile
nexus-v4/infra/systemd/nexus-backend.service
```

发布自动化改动必须作为独立 commit 先合并并通过 non-production fixture，不进入 A/B 业务源码 commit；该 commit 未验收前禁止调度 A/B 生产发布。工作流文件只从受保护 `origin/main` 解析，固定增加并验证六个 `workflow_dispatch` 输入：

```text
source_commit       = 40 位 A 或 B commit
artifact_role       = metadata-safe | cimd-enabled
execution_mode      = fixture | release
safe_rollback_commit = artifact_role=cimd-enabled 时必填 A commit；metadata-safe 时必须为空
safe_rollback_bundle_sha256 = cimd-enabled+fixture 时必填 F-A-BIN-01/F-A-FIXTURE-LIVE-01 的唯一 A SHA；cimd-enabled+release 时必填 A-BIN-01/A-LIVE-01 的唯一 A SHA；metadata-safe 时必须为空
safe_rollback_manifest_sha256 = 与上述 mode-specific A bundle 绑定的 manifest SHA；metadata-safe 时必须为空
```

工作流使用 `actions/checkout fetch-depth:0` 精确 checkout `source_commit`，构建前同时断言 `git rev-parse HEAD=source_commit` 且 `git merge-base --is-ancestor source_commit origin/main` 成功。它还必须按第 2.1 节重建 BASE→R→A→B 直接父子链并对每个 commit 执行 path allowlist；`cimd-enabled` 的 `safe_rollback_commit` 必须等于 `git rev-parse source_commit^`。`fixture` 模式的三个 safe rollback 输入必须匹配 F-A-BIN-01/F-A-FIXTURE-LIVE-01，`release` 模式必须匹配 A-BIN-01/A-LIVE-01；两种模式都必须从该 SHA 精确 locator 取回，禁止仅按 A commit 重建或选择另一 A bundle。

现有单 job `environment: production` 必须拆成以下固定 DAG：

1. `build_test`：不绑定 production environment，不读生产 secret；完成 ref 门禁、Docker 内 CGO 全测试、构建、payload manifest 和 bundle digest。
2. `quarantine`：将未批准 bundle 以 GitHub Actions 短期 artifact 保留 24 小时，记录平台 artifact digest；不上传 production primary/DR。
3. `owner_attest`：`execution_mode=fixture` 使用 `backend-release-fixture-owner`，`release` 使用 `backend-release-owner`；由 owner IdP subject 对 digest subject 签名。
4. `approver_attest`：分别使用 `backend-release-fixture-approver` 或 `backend-release-approver`；必须是与 owner 不同的 IdP subject，对同一 digest subject 签名。
5. `mirror_readback`：只在两份 attestation 通过后使用 OIDC release role。`fixture` 只写 primary/DR `workflow-fixture/<runId>/` 并双读回；`release` 写入正式内容寻址 locator 并双读回。
6. `fixture_deploy`：仅 `execution_mode=fixture` 可进入，在无生产 secret、不连生产 DB/Redis/外部网络的临时 Linux VM/container 执行 systemd/current 迁移等价 fixture。A fixture 产生 F-A-BIN-01/F-A-FIXTURE-LIVE-01；B fixture 必须绑定该 A record、执行 B→A 原子回滚并产生 F-B-RBK-01。fixture 永不连接生产主机或进入 production deploy job。
7. `deploy`：仅 `execution_mode=release` 可进入，使用受保护 `production` environment，下载已双读回的 primary bundle 并再验 digest/内层 manifest后部署。

两份批准的签名对象逐字节固定为：

```text
JCS(["acosmi-backend-bundle-approval-v1",{
  artifactRole,
  sourceCommit,
  bundleSizeBytes,
  bundleSha256,
  deploymentManifestSha256,
  workflowRunId,
  executionMode,
  systemdUnitSha256,
  safeRollbackCommit,
  safeRollbackBundleSha256,
  safeRollbackManifestSha256
}])
```

只批 workflow run/environment 而不绑定上述 digest subject 不构成批准。`backend bundle stores + 四个 owner/approver environment + OIDC role + F-A-BIN-01 + F-A-FIXTURE-LIVE-01 + F-B-RBK-01` 共同构成 `ACOSMI-REL-BASE`；它未通过时不部署生产 A/B。`P0-0A-BOOTSTRAP` 的 2-of-3/HMAC/offline-root 等全局 trust-path 门独立并行，只阻断未来 `GENESIS-INTEGRATION`/remote-capable lock。

生产 bundle 继续使用 `nexus-v4/backend/Dockerfile` 构建，`GIT_COMMIT=source_commit`，`BUILD_TIME` 只由工作流 UTC 时钟生成。从镜像提取 `server` 与七个 `.so`，生成 payload manifest，打包后按上述 DAG 批准、上传、独立重取并校验 bundle 与内层 manifest，再从已验收 primary 字节部署；禁止直接部署 runner 工作目录或 quarantine 中未双读回的字节。

R 对现有唯一生产部署工作流的改动只允许落在 input/build-test/quarantine/digest-attestation/mirror-readback/atomic-switch/rollback 区块。R validator 必须对 BASE 中现有 JWT fingerprint、PostgreSQL/Redis identity、`MOBILE_ROLLOUT_SALT`、Account Bridge 两把私钥/版本策略、schema bootstrap、health check 区块分别生成 baseline slice SHA，并断言 R 中这些 slice 逐字节不变。A/B 部署前后必须继续验证 JWT/PG/Redis identity，并断言 `MOBILE_ROLLOUT_SALT`、Account Bridge 私钥与策略的只显示 digest 全部未变；任一变化都中止并回滚当次切换。

生产部署不再直接解压覆盖 live `server/lib`，固定使用：

```text
/opt/acosmi/releases/<bundle-sha256>/server
/opt/acosmi/releases/<bundle-sha256>/lib/*.so
/opt/acosmi/releases/<bundle-sha256>/deployment-manifest.json
/opt/acosmi/nexus-backend/current -> /opt/acosmi/releases/<bundle-sha256>
```

R 将仓内 `nexus-v4/infra/systemd/nexus-backend.service` 固定改为 `WorkingDirectory=/opt/acosmi/nexus-backend`、`ExecStart=/opt/acosmi/nexus-backend/current/server`、`LD_LIBRARY_PATH=/opt/acosmi/nexus-backend/current/lib`，`.env` 仍位于 `/opt/acosmi/nexus-backend/.env`。工作流对 unit 原始字节计算 `systemdUnitSha256`并纳入两份 digest approval。首次迁移前先把当前 live `server/lib` 复制到只读 `pre-A-observed` 版本目录并记录 manifest/version（仅允许 A 首次失败回退，不得成为 artifactRole），再备份线上 unit、安装 R unit、`systemctl daemon-reload`，将 `current` 先指向 `pre-A-observed` 并验证服务行为不变。迁移失败必须恢复原 unit/直连路径、daemon-reload 并重验基线健康。

每个 release 目录在 digest/内层 manifest/version 验证后设为只读；切换时先停止服务，用同文件系统 symlink rename 原子更换 `current`，再启动和 health check，禁止逐文件覆盖造成 binary/`.so` 混用。fixture 必须同时验证旧 unit→R unit/current 迁移、迁移失败恢复和 A/B 原子切换。

`cimd-enabled` 切换前必须将 digest approval 中 `safeRollbackBundleSha256/safeRollbackManifestSha256` 指向、已从 primary/DR 双读回验收的唯一 A bundle 预置到 `/opt/acosmi/releases/<safeRollbackBundleSha256>/`，再次验证只读文件、manifest 和 version，且该目录不得被 cleanup。B 失败 trap 优先原子切回该本地 A cache；本地 cache 失效时才依次从同一 SHA 精确 A primary、DR 重取。三者都无法通过验证时保持服务停止并进入 P0 incident，禁止启动半部署 B 或混合 bundle。primary/DR 仍是制品真源，本地只读 A 仅是可用性缓存。

### 3.3 不可交换的部署顺序

1. 在 `ACOSMI-REL-BASE`（backend stores+四个 digest-specific approval environments+OIDC role+fixture）已通过后，从 A primary 重取完整 bundle，校验 bundle size/SHA 及内层 manifest，先在不连接生产 DB/Redis/外部服务的隔离 fixture 中验证 health+两份 metadata，再按第 3.2 节原子切换生产 A。`P0-0A-BOOTSTRAP` 与 P0-1 并行，不阻断 A/B safe deployment。
2. 验证 `/opt/acosmi/nexus-backend/current` 解析到 A-BIN-01 的 exact bundle SHA 目录，该目录八个 payload 都匹配 A manifest，`--version`=A commit、health 通过；同时验证普通和 desktop metadata 中 CIMD key 都缺席，且 DCR `registration_endpoint` 仍存在，然后才生成 A-LIVE-01。
3. 从 B primary 重取完整 bundle，校验 bundle size/SHA 及内层 manifest，部署 B。
4. 在 Acosmi CN 生产主机使用 loopback/SNI 验收。
5. 在美国洛杉矶审计机使用公网 DNS/TLS 验收。
6. 比较两地的 status、headers 和 JSON 语义；任一差异就回滚 B 至 A。
7. 在任何 generation=2 宿主生产发布之前，按第 3.5 节对线上 B 执行一次受控 B→A 完整 bundle 回滚演练，验证 A version/内层 manifest/两份 AS metadata。
8. 演练通过后，从已验收 primary 重取与第 3 步 SHA 完全相同的 B bundle，重新部署并重跑第 4–6 步全部验收，最终线上角色必须是 B=`cimd-enabled`。
9. 只在发布流水线证据、A/B 验收、B→A 演练和演练后 B 最终态全部通过后写入 P0-1 完成证据。

禁止直接从当前生产制品跨过 A 部署 B。不修改 Nginx；部署前后都保留 Nginx 生效配置校验和，差异非空即中止。

A 在隔离 fixture 失败时不切换生产。A 已切换但在 `A-LIVE-01` 记录前失败时，只允许原子切回 `pre-A-observed` 目录，P0-1 保持 blocked、P0-0E remote=0；`A-LIVE-01` 通过后，`pre-A-observed` 永久丧失可执行回滚资格，后续只能使用 A 或保留两处 metadata key 缺席的更新 safe bundle。

### 3.4 生产验收命令与机器判定

A 部署后在 CN 主机执行：

```bash
curl --fail-with-body --silent --show-error \
  --resolve acosmi.com:443:127.0.0.1 \
  https://acosmi.com/.well-known/oauth-authorization-server | \
  jq -e '
    (has("client_id_metadata_document_supported") | not) and
    .issuer == "https://acosmi.com" and
    .registration_endpoint == "https://acosmi.com/oauth/register"
  '

curl --fail-with-body --silent --show-error \
  --resolve acosmi.com:443:127.0.0.1 \
  https://acosmi.com/.well-known/oauth-authorization-server/desktop | \
  jq -e '
    (has("client_id_metadata_document_supported") | not) and
    .issuer == "https://acosmi.com" and
    .registration_endpoint == "https://acosmi.com/oauth/desktop/register"
  '
```

B 部署后，CN 主机执行以下确定命令：

```bash
curl --max-redirs 0 --fail-with-body --silent --show-error \
  --resolve acosmi.com:443:127.0.0.1 \
  --dump-header - \
  https://acosmi.com/oauth/crabcode-client-metadata

curl --fail-with-body --silent --show-error \
  --resolve acosmi.com:443:127.0.0.1 \
  https://acosmi.com/oauth/crabcode-client-metadata | \
  jq -e '
    (keys | sort) == ([
      "client_id",
      "client_name",
      "grant_types",
      "redirect_uris",
      "response_types",
      "token_endpoint_auth_method"
    ] | sort) and
    .client_id == "https://acosmi.com/oauth/crabcode-client-metadata" and
    .client_name == "CrabCode" and
    .redirect_uris == ["http://127.0.0.1/callback"] and
    .grant_types == ["authorization_code", "refresh_token"] and
    .response_types == ["code"] and
    .token_endpoint_auth_method == "none"
  '

curl --fail-with-body --silent --show-error \
  --resolve acosmi.com:443:127.0.0.1 \
  https://acosmi.com/.well-known/oauth-authorization-server | \
  jq -e '
    (has("client_id_metadata_document_supported") | not) and
    .issuer == "https://acosmi.com" and
    .registration_endpoint == "https://acosmi.com/oauth/register"
  '

curl --fail-with-body --silent --show-error \
  --resolve acosmi.com:443:127.0.0.1 \
  https://acosmi.com/.well-known/oauth-authorization-server/desktop | \
  jq -e '
    (has("client_id_metadata_document_supported") | not) and
    .issuer == "https://acosmi.com" and
    .registration_endpoint == "https://acosmi.com/oauth/desktop/register"
  '
```

洛杉矶审计机执行以下公网命令：

```bash
curl --max-redirs 0 --fail-with-body --silent --show-error \
  --dump-header - \
  https://acosmi.com/oauth/crabcode-client-metadata

curl --fail-with-body --silent --show-error \
  https://acosmi.com/oauth/crabcode-client-metadata | \
  jq -e '
    (keys | sort) == ([
      "client_id",
      "client_name",
      "grant_types",
      "redirect_uris",
      "response_types",
      "token_endpoint_auth_method"
    ] | sort) and
    .client_id == "https://acosmi.com/oauth/crabcode-client-metadata" and
    .client_name == "CrabCode" and
    .redirect_uris == ["http://127.0.0.1/callback"] and
    .grant_types == ["authorization_code", "refresh_token"] and
    .response_types == ["code"] and
    .token_endpoint_auth_method == "none"
  '

curl --fail-with-body --silent --show-error \
  https://acosmi.com/.well-known/oauth-authorization-server | \
  jq -e '
    (has("client_id_metadata_document_supported") | not) and
    .issuer == "https://acosmi.com" and
    .registration_endpoint == "https://acosmi.com/oauth/register"
  '

curl --fail-with-body --silent --show-error \
  https://acosmi.com/.well-known/oauth-authorization-server/desktop | \
  jq -e '
    (has("client_id_metadata_document_supported") | not) and
    .issuer == "https://acosmi.com" and
    .registration_endpoint == "https://acosmi.com/oauth/desktop/register"
  '
```

两地验收器必须将两类合同分开判定：

- CIMD：status=200、无 `Location`、无 `Set-Cookie`、Content-Type 等于 `application/json; charset=utf-8`、Cache-Control 等于 `public, max-age=300, must-revalidate`、body 不超过 5120 bytes，exact six-key JSON 及值全匹配。
- 普通/desktop AS metadata：status=200、无 `Location`、Content-Type media type 为 `application/json`，`issuer=https://acosmi.com`，对应 `registration_endpoint` 逐字符匹配，虚假 CIMD key 缺席；不对 AS metadata 强加 CIMD 的 Cache-Control 或 5120-byte 限制。

洛杉矶公网组额外验收公网 DNS/TLS/反向代理/后端完整链。人工目测 curl 输出不能替代机器判定。

另外必须验证生产 binary `--version` 与 B commit 逐字符一致，以及 Nginx 部署前后配置校验和相同。

### 3.5 安全回滚

回滚目标唯一固定为已验收的 A=`metadata-safe`：

1. B 任一本机/公网/版本验收失败时，停止 P0-1 完成证据写入。
2. 按“已复验本地只读 A cache → A primary → A DR”的唯一顺序取得首个通过 bundle size/SHA、内层 manifest 和 version 验证的 A 目录，停止服务后原子将 `current` 切到该目录，重启并 health-check；禁止逐文件恢复。
3. 重验两份 AS metadata 中虚假 key 缺席。
4. 记录 B 失败的精确阶段、HTTP 差异、B SHA、A SHA、操作人与审批人证明。
5. CrabCode 下游继续以 canonical reasonCode=`cimd-document-unavailable` fail-close，不在同一登录中切换 DCR。

在 `A-LIVE-01` 通过之后，禁止回滚到 A 之前任何仍输出 `client_id_metadata_document_supported=true` 的 bundle，也禁止混用 A/B/当前制品的 binary 与 `.so`。如 A 自身发现回归，只能从 A 源码线构建保留“两处 key 缺席”的新 safe bundle，不得恢复虚假广告。

第 3.3 节的计划内回滚演练在完成上述 A 验证后不停留于 A；必须重新部署原 B bundle、重跑 CN/LA CIMD、两份 AS metadata、version 和 Nginx checksum 验收，并生成 `B-FINAL-01`。故障触发的真实回滚则停在 A 并保持 profile fail-close，P0-1 不标记完成。

## 4. `P0-0A-BOOTSTRAP`：独立 trust-path bootstrap

本节与 P0-1 源码/`ACOSMI-REL-BASE` 相互独立，可并行；它是后续 `GENESIS-INTEGRATION` 的强制前置，但不是 A/B 的前置。全局 lock schema、component approvals、lease、key-set transition 和宿主验证算法严格以主方案第 6.1、8、10 节为准；Bootstrap canary schema 只验 `environment=test` 基础设施，不引用尚未生成的 production lock/plugin/marketplace/host artifact。

`P0-0A-BOOTSTRAP` 必须交付：

1. 公开 primary 固定为 `Alibaba Cloud OSS/accountAlias=acosmi-release-cn/region=cn-hangzhou/oss://acosmi-mcp-safe-primary-cn-hangzhou/crabcode/mcp-safe/`，`https://updates.acosmi.com/crabcode/mcp-safe/<key>` 逐 key 映射到 `oss://acosmi-mcp-safe-primary-cn-hangzhou/crabcode/mcp-safe/<key>`；primary 开启 versioning+WORM，禁止删除/改写旧 version/bypass retention。在独立 AWS accountAlias=`acosmi-release-dr`/`us-west-2` 创建 `s3://acosmi-mcp-safe-dr-us-west-2/crabcode/`，runtime DR 使用不依赖 `acosmi.com` DNS zone 的 `https://acosmi-mcp-safe-dr-us-west-2.s3.us-west-2.amazonaws.com/crabcode/`。DR bucket policy 只允许 `crabcode/mcp-safe/**` 与 `crabcode/host/**` 两前缀下 exact object GET/HEAD，禁止 public List/Put/Delete；其他 sibling prefix 必须被拒绝。每个 `visibility=public` artifact 必须在签名 lock 中同时绑定 HTTPS primary `artifactRef`、AWS 直接 HTTPS `runtimeMirrorRef` 和同 key S3 `disasterRecoveryRef`，三者 size/SHA 一致；`visibility=release-private` 的 `runtimeMirrorRef=null`。
2. 创建 evidence primary=`Alibaba Cloud OSS/accountAlias=acosmi-release-cn/region=cn-hangzhou/oss://acosmi-private-release-evidence-cn-hangzhou/`、DR=`Alibaba Cloud OSS/accountAlias=acosmi-legal-dr-cn/region=cn-shanghai/oss://acosmi-private-release-evidence-dr-cn-shanghai/`；provider/component approval 原文只进 evidence 私有库。实际 account ID 不入仓，只将与稳定 alias 绑定的 salted hash 写入 bootstrap 证据。`legal` 和 `data-governance` 必须分别签署数据分类/保留/境内备份 policy 的 digest-specific attestation。backend bundle primary/DR 与 rollback audit 属 `ACOSMI-REL-BASE`，不在本项重复验收。
3. 为公开 lock/evidence primary/DR 和私有 evidence 开启 versioning + Object Lock Compliance/WORM。lock/envelope 和不含个人/合同原文的 component approval attestation 永久保留；provider 原文在中国境内 primary/DR 保留至到期、撤销或最后生产引用三者中最晚日期 +7 年，只允许 legal hold 延长。业务身份无 delete、bypass retention 或改写旧 version 权限。backend bundle WORM 由 `ACOSMI-REL-BASE` 独立证明。
4. `P0-0A-BOOTSTRAP` 只钉住 release-signing/security/legal 这条 trust path 的 IdP subject/public-key allowlist 和审批 subject；`backend-release-*` 四个 protected environment 是 `ACOSMI-REL-BASE` 资源，本节只允许以 `relBaseEvidenceSha256` 引用，不将其存在视为 bootstrap pass。
5. 创建 `thresholdPolicy=2-of-3` 的 A/B/C 三把 Ed25519 release key：A 归 `release-signing`，B 归独立账号 `security`，C 由 `security` + `acosmi-release` 双人线下保管。另建不参与日常签名的 offline release-root key，只在两把当前 key 永久不可恢复或已泄漏并有 `security`/`acosmi-release` 两份 IdP+WORM 证据时恢复 key set；recovery 演练只使用 test key set/test locator，不销毁或替换生产 key。
6. 在私有 secret backend 创建 `providerEvidenceCommitmentKey`，备份由 `legal`/`security` 双人恢复；`legal` 与 `security` 分别持有 eligibility-verdict Ed25519 key，公开 verdict 必须两签。provider raw evidence 取回、HMAC 重算与 eligibility validator 固定在中国境内 VPC 的自托管 runner label=`self-hosted,linux,x64,cn-hangzhou,release-legal-validator` 执行，raw bytes 禁止进入 GitHub-hosted runner/artifact/cache/log，境外只接收最小双签 verdict+commitment；必须交付 egress deny 与 log/artifact 泄露扫描证据，并对公开 verdict 执行 provider/app/scope/region/distribution/reviewer/private URI/自由文本泄露扫描。
7. 生成不可变 `release-infrastructure-bootstrap.json`，只包含本 gate 拥有的脱敏 account ID hash、region、公开 lock/evidence primary/DR locator 及 policy/WORM SHA、OIDC issuer、CN validator runner-pool/egress-policy SHA、retention/residency attestation refs、releaseKeySetId/三个 keyId/offline-root keyId/thresholdPolicy、verdict public keyId、commitmentKeyId 与验收时间。backend stores/四个 backend environment 只用 `relBaseEvidenceSha256` 引用 `ACOSMI-REL-BASE` 的独立 evidence record，不复制为本 gate 所有。

### 4.1 Bootstrap canary 固定合同

`P0-0A-BOOTSTRAP` 不使用尚未存在的 production current head 自证。它用 CSPRNG 生成 128-bit random、32 位小写 hex `canaryId` 和独立 32-byte random `payload.bin`，只写 `bootstrap-canary/<canaryId>/`。三类 payload locator 固定为：

```text
payloadArtifactRef=https://updates.acosmi.com/crabcode/mcp-safe/bootstrap-canary/<canaryId>/payload.bin
payloadRuntimeMirrorRef=https://acosmi-mcp-safe-dr-us-west-2.s3.us-west-2.amazonaws.com/crabcode/mcp-safe/bootstrap-canary/<canaryId>/payload.bin
payloadDisasterRecoveryRef=s3://acosmi-mcp-safe-dr-us-west-2/crabcode/mcp-safe/bootstrap-canary/<canaryId>/payload.bin
```

`BootstrapCanaryEnvelope` 字段固定为：

```text
schemaVersion=1
environment=test
canaryId
issuedAt
expiresAt=issuedAt+15 minutes
payloadArtifactRef
payloadRuntimeMirrorRef
payloadDisasterRecoveryRef
payloadSizeBytes=32
payloadSha256
signedAt
releaseKeySetId
previousReleaseKeySetId=null
keySetTransitionRef=null
thresholdPolicy=2-of-3
signatures[{keyId,signatureAlgorithm=Ed25519,signature}]
```

至少两把不同 keyId 对下列 exact subject 签名：

```text
JCS(["mcp-bootstrap-canary-v1",{
  schemaVersion,
  environment,
  canaryId,
  issuedAt,
  expiresAt,
  payloadArtifactRef,
  payloadRuntimeMirrorRef,
  payloadDisasterRecoveryRef,
  payloadSizeBytes,
  payloadSha256,
  signedAt,
  releaseKeySetId,
  previousReleaseKeySetId,
  keySetTransitionRef,
  thresholdPolicy
}])
```

使用同一 release key set 但独立 domain separator。envelope 原始字节固定发布到：

```text
https://updates.acosmi.com/crabcode/mcp-safe/bootstrap-canary/<canaryId>/head.json
https://acosmi-mcp-safe-dr-us-west-2.s3.us-west-2.amazonaws.com/crabcode/mcp-safe/bootstrap-canary/<canaryId>/head.json
s3://acosmi-mcp-safe-dr-us-west-2/crabcode/mcp-safe/bootstrap-canary/<canaryId>/head.json
```

三个 bootstrap mutable head 的 origin/CDN/object metadata 都固定 `Cache-Control: no-store`，取回请求发送 `Cache-Control: no-cache`。内容寻址 payload/envelope 与 production lock/envelope/`heads/<lockSequence>.json` 固定 `Cache-Control: public, max-age=31536000, immutable`；production mutable `head.json` 同样固定 `no-store`，宿主取回同样发送 `no-cache`。插件 marketplace 不属 bootstrap canary；它在 `GENESIS-INTEGRATION` 只按真实 `https://updates.acosmi.com/crabcode/plugins/crabcode-plugins-official/{latest,<sha>.zip,<sha>.zip.sha256,marketplace.json,marketplace.json.sha256}` 合同验收。

production validator 只接受 `mcp-release-lock schemaVersion=2,environment=production,lockSequence>=1`，在验签前就必须拒绝 `BootstrapCanaryEnvelope`；canary 不得更新 production `head.json`、不得进入 production lock chain 或宿主高水位。

### 4.2 `P0-0A-BOOTSTRAP` 验收

以下项目必须全部通过。所有故障演练只操作 `environment=test` canary/test identity/test secret backend：DNS 故障只在 clean fixture 的本地 resolver 对 `acosmi.com` 做 deny，primary 凭据故障只撤掉 canary job identity 或在该 job 内 deny primary egress，HMAC/offline-root recovery 只用 test key copy/test key set。禁止修改生产 DNS、撤销生产 release identity、破坏生产 secret/key 或对非 canary object 执行 delete/retention 负测：

- primary 底层 OSS、`updates.acosmi.com` HTTPS 映射、AWS HTTPS/S3 写入/读回同一 canary payload/envelope，各自 size/SHA 一致且 HTTPS→object key 映射逐字符正确；
- 两处 cloud/account/region 确认不同；
- 无对象存储凭据 clean fixture 可从 primary 和 AWS 直接域名独立取回、验签、验 payload；
- `crabcode/mcp-safe/**` 与 `crabcode/host/**` 的 canary exact GET/HEAD 均通过，sibling prefix GET 与 ListBucket 均被拒绝；
- canary head 连续 Put v1/v2 生成两个 version ID，v1 仍可按 version ID 取回；
- canary head v1→v2 更新后，primary 底层 object、`updates.acosmi.com` CDN、AWS HTTPS/S3 立即无认证 GET 都返回 v2 字节和 `Cache-Control: no-store`；内容寻址对象返回长缓存+`immutable`；
- delete、改写旧 version、bypass retention 全部被拒绝；
- clean fixture 本地 resolver deny `acosmi.com` 后，仍可从 AWS 直接域名取回并验签；生产 DNS 不变；
- 撤掉 canary job identity 的 primary 权限或在该 job deny primary egress 后从 DR 完成取回；生产 release identity 不撤销；
- 两个不同 IdP subject 产生可验的 owner/approver attestation；
- 2 签正向通过；1 签不足、重复 keyId、错 key、改字节均拒绝；
- test secret backend 中的 HMAC key copy 故障后双人恢复/重算一致，eligibility verdict 单签/错 profile/fingerprint/篡改 lease 全部拒绝；生产 HMAC key 不破坏、不轮换；
- 短时 HSM/网络故障禁止启用 offline root，满足永久不可恢复条件时 offline-root recovery 正向演练通过。

任一项失败：`P0-0A-BOOTSTRAP=blocked`，不进入 `GENESIS-INTEGRATION`，remote profile 不解禁。该失败不改变 `ACOSMI-REL-BASE` 或 A/B 状态。canary 保留为证据，不执行例外删除。

### 4.3 `GENESIS-INTEGRATION` 验收

只在 `P0-0A-BOOTSTRAP=pass`、safe plugin/marketplace/host artifacts 已从真实 locator 发布并读回，且 lock 所引用 backend 已有 `ACOSMI-REL-BASE` exact evidence 时，才允许组合首份 production lock。签名后从 public primary/runtimeMirror/DR 取回 lock 及每个 public artifact 验 size/SHA；private artifact 必须 `runtimeMirrorRef=null`且宿主不访问。backend 只验 `relBaseEvidenceSha256` 指向的独立 record，不倒灌为 bootstrap 证据。

插件镜像没有多文件事务，顺序固定为：上传 immutable `<sha>.zip` + `<sha>.zip.sha256` 并公网读回→复核远端 main/当次 SHA→单文件切 `plugins/crabcode-plugins-official/latest`（runtime 唯一线性化点）→最后更新非权威 `marketplace.json` projection 与 checksum。projection 不一致使全系统审计 blocked，但不得先用新 projection 宣称旧 `latest` runtime 已升级，也不得把 projection 当 runtime pointer。两代 clean fixture 安装并重启后 remote=0。验收器还必须证明不存在“先需 lock 才能 bootstrap，先需 bootstrap 才能生 lock”的环。任一项失败：不更新 production head，remote profile 不解禁，也不回滚已通过的 A/B。

## 5. 与 CrabCode / CrabCode-Plugin 的交接合同

下表中“交接合同镜像”不授权 Acosmi 修改下游仓：

| 交接项 | 固定合同 | Owner | Acosmi 责任 |
| --- | --- | --- | --- |
| 输入 callback | 候选 CIMD 注册值 `http://127.0.0.1/callback`；实际授权为 `http://127.0.0.1:<os-assigned-port>/callback`；只在 AS/provider 证明 RFC 8252 port exception 后可用 | `crabcode-mcp` | CIMD 只输出静态注册值；不修改 listener；不输出 wildcard/模板 |
| 输出 CIMD | public GET 200、固定 JSON/headers、无重定向 | `acosmi-backend` | 实现、测试、双地点发布验收 |
| 输出 AS metadata | 两份 metadata 都不含虚假 key | `acosmi-backend` | 实现、测试、先 A 后 B 部署 |
| 证据 | A/B backend commit/version、双地点 CIMD+AS metadata curl、bundle/inner-manifest size/SHA、primary+DR、双人 attestation | `acosmi-ops` | 生成可验、无 secret 的 evidence record |
| 联合解锁 | generation=2 + RFC 9207 `iss` + RFC 8707 双请求 `resource` + AS metadata `S256` + 真实 OAuth/reconnect/tools-list/canary/同意页证据 + release gate | 联合门 | P0-1 证据只作为其中一个前置 |

当前 Notion 10、Linear 5、Canva 1、Synapse 1，共 17 条历史声明/候选映射继续 blocked；当前不存在可被宿主消费的 generation=2 binding artifact。只有在 Acosmi P0-1、CrabCode `authPolicyGeneration=2`、签名 release gate 及对应供应商逐 profile 真实授权、`iss/resource/S256`、targeted reconnect、`tools/list`、只读 canary 与同意页风险证据全部通过后，该 profile 才能由更高序号 lock 解锁。

P0-1 本身不实现下列下游事项：

- CrabCode OS-assigned loopback listener、PKCE、RFC 9207 `iss`、RFC 8707 `resource`、S256 metadata gate、auth policy generation/fingerprint、凭据仓和 targeted reconnect；
- CrabCode-Plugin catalog/binding、provider basis、ToolSearch、Skill capability gate、marketplace 发布；
- Notion/Linear/Canva/Synapse 供应商账号、审批、scope 和 canary tenant。

## 6. 证据清单与完成门

### 6.1 P0-1 必须证据

| ID | 证据 | 机器判定 | 失败动作 |
| --- | --- | --- | --- |
| `REL-PIPE-01` | R commit + non-production fixture | BASE→R direct parent/path allowlist；Docker CGO 测试；unit digest/迁移/恢复；固有 JWT/PG/Redis/salt/Account Bridge/schema/health slice SHA 不变；DAG 双人 digest approval、bundle 双写/重取、原子 B→A trap 全通过 | 禁止构建/部署 A/B |
| `F-A-BIN-01` | fixture A bundle/manifest/digest/readback | fixture primary/DR 同字节，version=A | 最小 REL prerequisite 不通过 |
| `F-A-FIXTURE-LIVE-01` | 隔离 fixture A health+metadata | 两份虚假 key 缺席、DCR 存在 | 禁止 fixture B/生产 A |
| `F-B-RBK-01` | fixture B→A 原子回滚 | B 绑定 fixture A exact SHA，current 切 A，health/metadata 通过 | 禁止生产 A/B |
| `A-SRC-01` | A commit/diff | A.parent=R，只含两个 metadata 源码点和对应测试 | 不构建 A |
| `A-BIN-01` | A bundle size/SHA/version/inner manifest + primary/DR readback | 两地 bundle SHA 相同，内层 8 个 payload 全匹配 | 不部署 A |
| `A-LIVE-01` | A 生产 current/bundle/health/AS metadata | current target SHA=A-BIN-01，version=A commit，8 payload=manifest，health 通过，虚假 key 缺席且 DCR 仍存在 | 不部署 B |
| `B-SRC-01` | B commit/diff | B.parent=A，三个 safe rollback 输入匹配唯一 A artifact record，只含 handler/route/tests | 不构建 B |
| `B-BIN-01` | B bundle size/SHA/version/inner manifest + primary/DR readback | 两地 bundle SHA 相同，内层 8 个 payload 全匹配，version=B commit | 不部署 B |
| `B-LIVE-CN-01` | CN loopback/SNI CIMD + AS metadata | exact HTTP/JSON 合同 | 回滚 B 至 A |
| `B-LIVE-LA-01` | LA 公网 CIMD + AS metadata | 与 CN 语义一致 | 回滚 B 至 A |
| `B-NGX-01` | Nginx 部署前后 checksum | 完全相同 | 中止并移除配置差异 |
| `B-RBK-01` | B→A 完整 bundle 回滚演练 | A version 生效、binary/library 均来自 A manifest、两份 metadata key 缺席 | P0-1 不完成 |
| `B-FINAL-01` | 演练后重部署原 B 及全量复验 | 线上 SHA/version=B，CN/LA CIMD+AS metadata+headers 通过，Nginx checksum 未变 | P0-1 不完成 |

P0-1 完成必须同时满足上表全部十四项。任一证据缺失或为 `not-tested` 时，状态固定为 `blocked`，不得写“条件通过”“基本完成”或“等待确认”。

### 6.2 `P0-0A-BOOTSTRAP` 与 `GENESIS-INTEGRATION` 必须证据

`P0-0A-BOOTSTRAP` 证据只包括：`release-infrastructure-bootstrap.json`、BootstrapCanaryEnvelope/payload 三类 exact locators/size/SHA、mutable head `no-store`/request `no-cache`/内容寻址 `immutable` 及 v1→v2 新字节证据、`mcp-safe/host` 前缀正测与 sibling/List 负测、Object Lock/version IDs/拒绝证据、clean-fixture resolver deny、canary identity/egress 故障演练、2-of-3 正负测、test HMAC recovery、eligibility 双签、CN validator egress/log/artifact 泄露扫描、retention/residency attestations 和 test-only offline-root recovery。任一项缺失则 `P0-0A-BOOTSTRAP=blocked`。

`GENESIS-INTEGRATION` 另行要求：public artifact primary/runtimeMirror/DR 三定位同 size/SHA、primary 断开后 runtime HTTPS mirror 取回、`relBaseEvidenceSha256` 绑定 backend/rollback audit/四 protected environments/OIDC attestations，以及真实插件镜像 `latest/<sha>.zip/.sha256/marketplace` 发布与宿主重启验收。任一项缺失则不生 production lock，但不倒推 bootstrap 或 A/B 失败。

公开证据不得包含 token、authorization code、state、client secret、SSH 密钥/路径、完整授权 URL query、供应商合同原文、provider reviewer subject 或 provider/legal evidence private locator。Acosmi backend bundle primary/DR locator 按主方案 `artifacts[] visibility=release-private` 合同记录，不属于上述 provider evidence 禁入字段。

## 7. RACI

| 事项 | Responsible | Approver | Consulted |
| --- | --- | --- | --- |
| A/B 源码、单测、全量回归 | `acosmi-backend` | `acosmi-release` | `crabcode-mcp`、`security` |
| R 发布自动化、systemd 原子迁移、fixture | `acosmi-ops` | `acosmi-release` | `acosmi-backend`、`security`、`qa-release` |
| A/B 构建、digest-specific 双人批准、primary/DR 发布 | `acosmi-ops` | `acosmi-release` | `release-signing`、`security` |
| CN/LA 双地点验收 | `acosmi-ops` | `acosmi-release` | `qa-release`、`support` |
| B→A 回滚与演练 | `acosmi-ops` | `acosmi-release` | `acosmi-backend`、`crabcode-mcp`、`security` |
| `ACOSMI-REL-BASE` backend DR/四环境/OIDC/fixture | `acosmi-ops` | `acosmi-release` | `security`、`qa-release`、`cost-owner` |
| `P0-0A-BOOTSTRAP` public lock/evidence DR/WORM/key/canary | `acosmi-ops` | `acosmi-release` | `security`、`legal`、`data-governance`、`cost-owner`、`qa-release` |
| `GENESIS-INTEGRATION` artifact/lock/镜像组合 | `lock-composition` | `marketplace-approver` | `plugin-platform`、`crabcode-release`、`acosmi-release`、`qa-release` |
| private evidence 分类/保留/驻留地 policy | `data-governance` | `legal` | `security`、`acosmi-ops`、`cost-owner` |
| 2-of-3 key set/offline root | `release-signing` | `acosmi-release` | `security`、`crabcode-release`、`marketplace-approver` |
| callback/`iss`/`resource`/S256/generation=2/reconnect | `crabcode-mcp` | `crabcode-release` | `acosmi-backend`、`plugin-platform`、`security` |
| 17 条候选映射建 binding/解锁 | `plugin-platform` | `marketplace-approver` | `provider-integrations`、`qa-release`、`acosmi-release` |

Responsible 与 Approver 不得是同一 IdP subject。无法验证身份分离时，发布与回滚演练都不得开始。

## 8. 明确非目标

本独立方案明确不执行：

1. 不修改 Nginx、DNS 或 TLS 路由来解决 CIMD 404。
2. 不在 Acosmi AS 授权服务端接线 CIMD URL client registration；未接线 helper 不计为能力。
3. 不复用或扩建现有 admin MCP OAuth handler。
4. 不建 confidential OAuth broker，不让客户 token 进入 Acosmi 服务端。
5. 不建常驻 CIMD 探针；P0 只要求每次发布的 CN/LA 双地点验收。
6. 不在同一登录中做 CIMD↔DCR fallback。
7. 不在本任务修改 CrabCode callback、generation、credential store、reconnect 或 UI。
8. 不在本任务修改插件 binding、Skill、ToolSearch、marketplace 或版本。
9. 不把 GitHub nightly、DR、WORM、OIDC 或双人审批写成当前已有能力；只有第 6.2 节全部证据交付后才能改为已验收。

## 9. 可追溯映射与同步规则

| 本文档 | 主方案映射 | 同步级别 |
| --- | --- | --- |
| 第 1 节当前证据 | 第 3.1–3.3 节 | 证据基线变化时两文档同改 |
| `ACOSMI-SRC-P0-1` | 第 6.2 节 | URL/callback/JSON/headers/metadata 任一变化时两文档同改 |
| `ACOSMI-REL-BASE` | 第 8 节发布/回滚顺序 | backend stores/四环境/OIDC/fixture、A/B 角色、发布顺序、回滚目标两文档同改 |
| `P0-0A-BOOTSTRAP` | 第 6.1、8、10 节 | 只管 public lock/evidence DR/WORM/key/canary，不管 A/B |
| `GENESIS-INTEGRATION` | 第 8、10 节 | safe artifacts + bootstrap + relBase evidence 无环组合，全局 schema 主方案真源 |
| 交接合同 | 第 4、6.3、8、10、14 节 | 只有跨仓同一变更才可修改 |

实施记录不覆写本方案。执行时应新建以合同号为前缀的 evidence/index 文件，逐项引用本文第 6 节 ID。所有项通过前，状态只能是 `planned`、`in-progress`、`blocked` 或 `passed`；`not-tested` 一律归入 `blocked`。
