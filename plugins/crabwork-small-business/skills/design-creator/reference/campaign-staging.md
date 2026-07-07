# 营销战役暂存与发布参考(Campaign staging & publishing)

一场战役的"暂存 + 发布"口径。**国内主路径**:内容在国内平台(公众号 / 小红书 / 抖音 / 视频号)**原生定时发布**——本技能产出可直接发布的打包件 + 一份排期 CSV,店主在各平台原生发布;战役登记到你的 CRM / 营销系统或本地。**外贸 / 跨境附录**:若店主用 HubSpot 经营海外社媒(Instagram / Facebook 等),见文末附录的 HubSpot Marketing API 口径。

> HubSpot 是**外贸 / 跨境可选**,非默认。国内平台无法接入 HubSpot Social,一律走主路径。

---

## 目录

1. [主路径:国内平台原生发布 + 排期 CSV](#主路径国内平台原生发布--排期-csv)
2. [战役登记(system of record)](#战役登记system-of-record)
3. [附录(外贸 / 跨境):HubSpot Marketing Hub API](#附录外贸--跨境hubspot-marketing-hub-api)

---

## 主路径:国内平台原生发布 + 排期 CSV

适用于**所有国内平台行**(公众号、小红书、抖音、视频号)——它们无法经任何海外社媒 API 自动发布,由店主在各平台原生发布(公众号在自己的编辑器里支持定时发布)。

对每个国内平台行,产出:

1. **可直接发布的打包件** —— 日期 / 时间、渠道、最终文案(已过阶段 4《广告法》/《价格法》自检)、已核验素材文件。
2. **覆盖全部行的排期 CSV**,列头:

```
Date,Time,Channel,Caption,ImageFile,Status
```

示例行:

```
2026-06-03,10:00 CST,小红书,"夏日亚麻上新:透气不闷汗 ☀️ ...",./assets/jun03_xhs_cover.png,待发布
```

`ImageFile` 为已核验的渲染素材——本地文件路径或托管 URL,取店主提供的那种。

告知店主:"我已把 HubSpot 无法发布的国内平台行整理成排期 CSV。按表在各平台原生发布——公众号可在其编辑器里设定时发布。[文件路径]"

> 平台适配、内容合规审查与发布留痕的更深工作流,路由到 `crabcode-media-ops:media-platform-adapter` 与 `crabcode-media-ops:media-ops`(见 SKILL 的「媒体发布路由」);未安装时按本节交付打包件供原生手动发布。

---

## 战役登记(system of record)

战役需要一个"记录中枢"以便集中追踪,但**不强绑单一平台**:

- **有 CRM / 营销系统**(企业微信 / 钉钉 / 飞书 / 有赞;外贸可选 HubSpot):把战役与各行登记到其营销 / 活动模块——**对象、字段以该平台当年开放平台文档为准**。企微 / 有赞的自建 wrapper 未上线前,登记走导出 / 粘贴 / 本地清单。
- **无 CRM**:把战役排期与打包件登记为本地文件(或 `crabcode-office-suite:crabcode-spreadsheets` 生成的表格),店主据此原生发布与追踪。

无论登记在哪,**上线动作由店主全程掌控**;本技能只暂存 / 登记为"待发布",绝不代发。

---

## 附录(外贸 / 跨境):HubSpot Marketing Hub API

**仅当店主做外贸 / 跨境、用 HubSpot 经营海外社媒(Instagram / Facebook / Twitter / LinkedIn 等)时适用。** 国内平台一律走主路径,不经此附录。

Requires: **HubSpot Marketing Hub Professional** (or higher).
Base URL: `https://api.hubapi.com`
Auth: Bearer token (OAuth 2.0 or private app token).
（套餐门槛与端点随 HubSpot 政策变动,以其当年官方文档为准。）

### Tier check

If you're unsure whether the user has Marketing Hub Professional:

```
GET /crm/v3/objects/companies?limit=1
```

Check the `subscriptionType` on the account. If the API returns a 403 on social endpoints, tell the user: "HubSpot campaign staging requires Marketing Hub Professional. Your current plan doesn't include it. I can export a scheduling CSV instead — would that work?"

### Create a campaign

```
POST /marketing/v3/campaigns
{
  "name": "Summer Sale 2026 — Social",
  "startDate": "2026-06-01",
  "endDate":   "2026-06-30",
  "currencyCode": "CNY",
  "utm": {
    "source": "social",
    "medium": "owned",
    "campaign": "summer-sale-2026"
  }
}
```

Response: `{ "id": "<campaign_id>", ... }` — save this for social post association.

### Create a social post

**Only for channels connected in HubSpot Social.** HubSpot's connectable channel types are `INSTAGRAM`, `FACEBOOK`, `TWITTER`, `LINKEDIN` — domestic platforms (公众号, 小红书, 抖音, 视频号) cannot be connected and go through the main path above instead.

One call per eligible calendar row. Stage as `SCHEDULED`, never `PUBLISHED`.

```
POST /marketing/v3/social/posts
{
  "campaignId": "<campaign_id>",
  "channelId":  "<hubspot_channel_id>",
  "content": {
    "body": "<approved caption text>"
  },
  "scheduledAt": "2026-06-03T10:00:00Z",
  "attachments": [
    {
      "url": "<hosted_url_of_verified_rendered_asset>"
    }
  ],
  "status": "SCHEDULED"
}
```

**`attachments[].url`** — a publicly accessible URL of the final rendered asset (verified against its design brief). If the owner only has a local file, stage the post without the attachment and tell them to add the image in HubSpot before send time.

**`channelId`** — the HubSpot Social account ID (not the platform name). Retrieve connected accounts:
```
GET /marketing/v3/social/channels
```
Match by `type` (`INSTAGRAM`, `FACEBOOK`, `TWITTER`, `LINKEDIN`) and use the `id` field.

**`scheduledAt`** — must be in the future (relative to the time of the API call). Use noon local time for the owner's timezone unless they specify otherwise.

### Verify the scheduled queue

After staging all posts:

```
GET /marketing/v3/social/posts?status=SCHEDULED&campaignId=<campaign_id>
```

Surface results in a table: date, channel, first 60 chars of caption, status. Provide the direct HubSpot campaign URL:
`https://app.hubspot.com/content/{portalId}/social/campaigns/{campaign_id}`

Tell the user: "Posts are scheduled and will publish automatically. You can cancel or edit any post in HubSpot before the send time."

### Field reference

| Field | Type | Notes |
|-------|------|-------|
| `campaignId` | string | UUID from campaign creation |
| `channelId` | string | From `GET /social/channels` |
| `content.body` | string | Caption text; max 2,000 chars |
| `scheduledAt` | ISO 8601 | Must be future time; include timezone offset |
| `attachments[].url` | string | Publicly accessible URL of the verified rendered asset |
| `status` | enum | Always `"SCHEDULED"` — never `"PUBLISHED"` |
