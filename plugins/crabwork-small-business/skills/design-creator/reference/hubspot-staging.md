# HubSpot Campaign Staging Reference

Requires: **HubSpot Marketing Hub Professional** (or higher).  
Base URL: `https://api.hubapi.com`  
Auth: Bearer token (OAuth 2.0 or private app token).

---

## Table of contents

1. [Tier check](#tier-check)
2. [Create a campaign](#create-a-campaign)
3. [Create a social post](#create-a-social-post)
4. [Verify the scheduled queue](#verify-the-scheduled-queue)
5. [Scheduling CSV (domestic platforms and non-Professional users)](#scheduling-csv-domestic-platforms-and-non-professional-users)
6. [Field reference](#field-reference)

---

## Tier check

If you're unsure whether the user has Marketing Hub Professional:

```
GET /crm/v3/objects/companies?limit=1
```

Check the `subscriptionType` on the account. If the API returns a 403 on
social endpoints, tell the user: "HubSpot campaign staging requires Marketing
Hub Professional. Your current plan doesn't include it. I can export a
scheduling CSV instead — would that work?"

---

## Create a campaign

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

---

## Create a social post

**Only for channels connected in HubSpot Social.** HubSpot's connectable
channel types are `INSTAGRAM`, `FACEBOOK`, `TWITTER`, `LINKEDIN` — domestic
platforms (公众号, 小红书, 抖音, 视频号) cannot be connected. Rows for
domestic platforms never go through this endpoint; they get the
[scheduling CSV](#scheduling-csv-domestic-platforms-and-non-professional-users)
and a publish-ready package instead, and the owner publishes natively.

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

**`attachments[].url`** — a publicly accessible URL of the final rendered
asset (verified against its design brief). If the owner only has a local
file, stage the post without the attachment and tell them to add the image
in HubSpot before send time.

**`channelId`** — the HubSpot Social account ID (not the platform name).
Retrieve connected accounts:
```
GET /marketing/v3/social/channels
```
Match by `type` (`INSTAGRAM`, `FACEBOOK`, `TWITTER`, `LINKEDIN`) and use the `id` field.

**`scheduledAt`** — must be in the future (relative to the time of the API
call). Use noon local time for the owner's timezone unless they specify
otherwise.

---

## Verify the scheduled queue

After staging all posts:

```
GET /marketing/v3/social/posts?status=SCHEDULED&campaignId=<campaign_id>
```

Surface results in a table: date, channel, first 60 chars of caption, status.
Provide the direct HubSpot campaign URL:
`https://app.hubspot.com/content/{portalId}/social/campaigns/{campaign_id}`

Tell the user: "Posts are scheduled and will publish automatically. You can
cancel or edit any post in HubSpot before the send time."

---

## Scheduling CSV (domestic platforms and non-Professional users)

Used in two cases:

1. **Domestic-platform rows** (公众号, 小红书, 抖音, 视频号) — always, since
   HubSpot cannot publish to them. The owner publishes natively; 公众号
   supports scheduled publishing in its own editor.
2. **Non-Professional HubSpot plans** — when Social staging isn't available
   at all.

Column headers:
```
Date,Time,Channel,Caption,ImageFile,Status
```

Example row:
```
2026-06-03,10:00 CST,Xiaohongshu,"Summer sale: 30% off candles ☀️ ...",./assets/jun03_xhs_cover.png,Ready to publish
```

`ImageFile` is the verified rendered asset — a local file path or hosted
URL, whichever the owner provided.

Tell the user: "I've prepared a scheduling CSV for the posts HubSpot can't
publish (domestic platforms). Publish each natively at the listed time —
公众号 posts can be scheduled inside the 公众号 editor. [file path]"

---

## Field reference

| Field | Type | Notes |
|-------|------|-------|
| `campaignId` | string | UUID from campaign creation |
| `channelId` | string | From `GET /social/channels` |
| `content.body` | string | Caption text; max 2,000 chars |
| `scheduledAt` | ISO 8601 | Must be future time; include timezone offset |
| `attachments[].url` | string | Publicly accessible URL of the verified rendered asset |
| `status` | enum | Always `"SCHEDULED"` — never `"PUBLISHED"` |
