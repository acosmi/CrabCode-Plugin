---
name: design-creator
version: 0.3.0
description: >
  Takes an approved content brief and executes a campaign end-to-end: builds
  the posting calendar, drafts per-channel copy, writes a precise design
  brief (dimensions, layout, text overlay, brand colors) for every visual
  asset, and stages the campaign in HubSpot. Asset rendering is done by the
  owner in their own design tool — the in-house cloud design service
  (自营云端设计) once its connector ships, or whatever tool they use today.
  This skill does not generate images. Email content is drafted as plain
  text for the owner to send from their own tool. Every step requires
  explicit owner approval. Use when the user says "make the content,"
  "generate the posts," "create the assets," "turn this into a campaign,"
  or hands off an approved brief for execution.
---

# Design Creator

## Scope

This skill handles a campaign in five sequential stages, each gated by owner
approval:

```
brief → calendar → asset inventory → design briefs → copy → HubSpot staging
```

| Path | Channels | What this skill produces |
|------|----------|--------------------------|
| Design brief (social) | WeChat Official Account (公众号), WeChat Channels (视频号), Xiaohongshu (小红书), Douyin (抖音) | Design brief + final caption + staged campaign entry in HubSpot |
| Text-only | Email (newsletter, marketing, drip) | Subject + preheader + body, surfaced inline for the owner to send |

**This skill does not render images.** The connector for the in-house cloud
design service (自营云端设计) is not yet available. For every visual asset,
the skill produces a complete, unambiguous design brief — dimensions,
layout, exact text overlay, image placement, brand colors — and the owner
renders it in 自营云端设计 once connected, or in whatever design tool they
use today. Never present an image as "generated" unless the owner supplied
the rendered file.

**No design assets for email rows under any circumstance.** The owner
explicitly descoped design work from the email path: emails from this skill
are text-only — subject, preheader, body. If the owner asks for a designed
email, see `reference/gotchas.md` for the redirect language.

---

## Pre-flight

Before Stage 1, confirm:

1. **Brief.** The user has referenced or pasted an approved brief. If not:
   "I'll need the content brief before I can build the campaign. Do you
   have one from the content-strategy skill, or would you like to write
   one now?"

2. **Rendering tool.** Ask which tool the owner will render assets in
   (自营云端设计 once its connector is live, or their current design tool).
   This only affects the handoff wording — the briefs are tool-agnostic.

3. **HubSpot tier.** Social staging requires Marketing Hub Professional,
   and HubSpot Social can only auto-publish to accounts connected in
   HubSpot. Domestic platforms (公众号, 小红书, 抖音, 视频号) cannot be
   connected to HubSpot Social — those rows get a publish-ready package
   and a scheduling CSV instead
   (see [reference/hubspot-staging.md](reference/hubspot-staging.md)).

4. **Brand assets.** Confirm the path to product photos on disk, and the
   brand colors/fonts (hex codes if the owner has them — ask once, reuse
   for every brief).

5. **Workload summary.** Count the design-brief rows and surface the total
   before Stage 1 begins:

   ```
   This campaign needs:
     Design briefs (social rows): 8  — you render each in your design tool
     Text-only rows (email):      2  — drafted inline, no design work

   Proceed?
   ```

---

## Workflow

### Stage 1 — Posting calendar

Pull from the brief: content themes, channels, cadence, hard dates
(launches, sales, holidays).

Build a calendar table with a `Path` column that routes every row to either
a design brief or text-only drafting:

| Date | Channel | Path | Theme | Asset type | Caption/Subject angle |
|------|---------|------|-------|------------|-----------------------|
| Jun 2 | Xiaohongshu | Design brief (social) | Linen launch | 3:4 image note | "finally, a dress…" |
| Jun 5 | Email | Text-only | Linen launch | Email body | "Linen that actually breathes" |

Tag every email-channel row as `Text-only` before presenting. Cap at 30
days unless the brief specifies otherwise. Flag scheduling conflicts (two
posts same day for the same product) up front.

**Checkpoint 1.** Present the calendar. Ask: "Does this match the plan?
Any dates to shift, channels to add, or themes to swap?" Iterate until
approved, then restate the split out loud — "N rows get design briefs, M
rows go through text-only drafting" — before moving on. Catching a
miscategorization here is free; catching it after the owner has rendered
designs isn't.

---

### Stage 2 — Asset inventory (design-brief rows only)

Email rows skip this stage entirely. For each `Design brief (social)` row,
build a manifest of what the layout needs and what's already available.

1. **Enumerate every image slot the layout needs.** A single-image post
   needs 1 photo; a 小红书 carousel or product grid can need 3+. List slots
   individually (`Cover`, `Product1`, `Product2`, …) — never roll them up
   as "product images."

2. **Inventory available assets.** Text content from the brief (product
   names, offer copy, taglines, pricing), product photos on the owner's
   disk (exact file paths), brand colors and fonts.

3. **Build the slot-by-slot gap table.** One row per slot per asset — not
   per asset.

   | Date | Slot | Kind | Available asset | Status |
   |------|------|------|-----------------|--------|
   | Jun 2 | Cover | image | ~/photos/linen_midi_01.jpg | ready |
   | Jun 2 | Headline | text | "Summer linen, finally" | ready |
   | Jun 9 | Product1 | image | — | **MISSING** |

4. **Resolve slot/asset mismatches with the owner.** If the layout calls
   for more photos than the brief provides, pause and ask:

   ```
   The Jun 9 carousel layout has 3 image slots. The brief gave me 1
   photo (linen_midi_01.jpg). How should I fill the other 2?

     1. Reuse the same photo across all 3 slots
     2. You point me at 2 more photos (file paths)
     3. Switch to a single-image layout
   ```

   No briefs go out with unresolved slots — a brief that says "product
   photo TBD" ships a placeholder into the owner's design tool.

5. **Confirm the manifest.** Show the owner the completed slot-by-slot
   table with every slot resolved to a real file or final text. This is
   the last stop before brief writing.

---

### Stage 3 — Design briefs + rendering handoff

Before writing any brief, re-read the calendar and drop any row whose
`Path` is not `Design brief (social)`. Email rows do not pass through this
stage.

For each design-brief row, write one complete brief using the template in
[reference/design-brief-spec.md](reference/design-brief-spec.md). Every
brief must be renderable without a follow-up question, and specifies:

- **Asset type and exact dimensions** (px) for the target channel
- **Layout** — where each element sits, in plain words
- **Text overlay** — the exact strings, verbatim; mark hierarchy
  (headline / subhead / CTA)
- **Image placement** — which file goes in which slot, by file path
- **Brand colors and fonts** — hex codes and font names from pre-flight
- **Style notes** — mood, whitespace, what to avoid

Present briefs in calendar order, one row at a time or batched — owner's
choice.

**Checkpoint 2 (briefs).** "Any briefs to adjust — layout, copy on the
image, photo choice?" Iterate until every brief is approved.

**Rendering handoff.** Hand the approved briefs to the owner:

```
All 8 design briefs are approved. Render them in your design tool
(自营云端设计 once the connector is live — until then, whichever tool you
use). Send back the finished files or hosted image URLs and I'll verify
them against the briefs and stage the campaign.
```

**Verification (when rendered files come back).** Check each rendered
asset against its brief before it goes anywhere near staging:

- Right photo in each slot (no stock placeholders, no gray boxes)
- Text overlay matches the approved strings verbatim
- Dimensions match the channel spec
- Nothing off-brief (wrong product, wrong colorway, lorem-ipsum)

If an asset misses, name the exact deviation ("the Jun 9 cover uses the
denim photo, brief calls for linen_midi_01.jpg") and ask the owner to
re-render just that one. The campaign can proceed row-by-row — verified
rows don't wait for stragglers unless the owner wants a single batch.

---

### Stage 4 — Copy drafting

For each calendar row, draft the copy. Social rows get a caption; email
rows get a full email.

**Social captions** — 公众号, 视频号, 小红书, 抖音:

- Length: channel-appropriate. Xiaohongshu: title ≤ 20 chars, body ≤
  1,000 chars. Douyin / WeChat Channels: short caption, hook in the first
  line. WeChat Official Account: article-style, 300–800 words for a promo
  post.
- Structure: hook → one product benefit → CTA → 3–6 hashtags/topics
  (not 30).
- Voice: match the brief's tone markers. If the brief says "casual and
  friendly," don't write corporate copy.
- No filler. No "Exciting news!" or "We're thrilled to announce." Open
  with the value.

**Email content** — this skill writes the entire email; no design work:

- Subject: ≤ 50 chars, specific, no clickbait. "Spring projects are
  booking up" beats "Don't miss out!"
- Preheader: ≤ 90 chars, complements the subject without repeating it.
- Body: plain prose, 100–250 words. Opening line that earns the read →
  1–2 paragraphs of substance → single clear CTA → sign-off.
- Voice: same tone markers as social. Owners want their emails to sound
  like them, not like a templated newsletter.
- No image references. Don't write "see image above." If the owner wants
  visuals, they add them in their email tool.
- One CTA per email. Pick the most important action and lead with it.

Present captions inline below each social row. Present full emails
inline below each email row:

```
Subject: <subject line>
Preheader: <preheader text>

<body text>
```

For worked examples, see
[reference/examples/boutique-brief-campaign.md](reference/examples/boutique-brief-campaign.md).

**Checkpoint 3.** "Any captions or emails to rewrite? Flag the date and
what to change." Iterate until approved.

---

### Stage 5 — HubSpot staging + handoff

HubSpot remains the campaign system of record. Email content is not
staged — it's surfaced inline for the owner to copy into their email tool.
For API field reference, see
[reference/hubspot-staging.md](reference/hubspot-staging.md).

1. **Create the campaign.** `POST /marketing/v3/campaigns` with the
   campaign name and start/end dates from the calendar.

2. **Stage HubSpot-connectable rows (if any).** HubSpot Social can only
   auto-publish to accounts connected in HubSpot. If the owner has such a
   channel connected, `POST` to the HubSpot Social API per row:
   - `channel`: map calendar channel to HubSpot account ID
   - `scheduledAt`: ISO 8601 datetime — confirm it's in the future before
     calling
   - `content.body`: approved caption
   - `attachments`: publicly hosted URL of the verified rendered asset —
     if the asset is only a local file, stage the post without the
     attachment and tell the owner to add the image in HubSpot
   - `status`: `SCHEDULED` (never `PUBLISHED`)

3. **Package domestic-platform rows.** 公众号, 小红书, 抖音, and 视频号
   cannot be published through HubSpot Social. For each of these rows,
   produce a publish-ready package — date/time, channel, final caption,
   verified asset file — plus one scheduling CSV covering all of them
   (format in [reference/hubspot-staging.md](reference/hubspot-staging.md)).
   The owner publishes natively in each platform (公众号 supports scheduled
   publishing in its own editor). Log the package against the HubSpot
   campaign so tracking stays in one place.

4. **Confirm the queue.** For staged HubSpot posts, call
   `GET /marketing/v3/social/posts?status=SCHEDULED` and surface the list
   with a direct link to the HubSpot campaign view. For packaged rows,
   surface the publish schedule table.

5. **Surface email content for handoff.** For each email row, present the
   approved subject + preheader + body inline, grouped by send date. The
   owner copies these into their email tool.

6. **Optional notification.** If DingTalk (钉钉) or Feishu (飞书) is
   connected, offer to send the owner a message with the publish schedule
   via the connected connector so it's on their phone.

**Final checkpoint.**

```
Campaign "Summer Linen" is set up in HubSpot: [link]

Publish schedule (you publish these natively):
  Jun 2, 10:00 — Xiaohongshu — linen launch note (asset: verified)
  Jun 4, 10:00 — 公众号 — social-proof article (asset: verified)
  …

Email content is drafted below — copy each into your email tool when
you're ready to send:

  Jun 5 — "Linen that actually breathes"

Want me to message this schedule to you on DingTalk/Feishu?
Anything to change before we're done?
```

---

## Approval gates

- **Never claim an image was generated.** No design connector is
  available; this skill produces briefs, and only the owner produces
  pixels. An asset exists when the owner hands back the file.
- **No design briefs for email rows.** Re-check the `Path` column before
  writing every brief.
- **No publishing.** HubSpot posts are staged as `SCHEDULED` only;
  domestic-platform rows are handed off as packages; the owner controls
  go-live everywhere.
- **Never stage a post whose rendered asset hasn't been verified against
  its brief.** Brief approval is not asset approval.
- **Never route a 公众号/小红书/抖音/视频号 row through the HubSpot Social
  API.** Those rows get the publish package + CSV.
- **Never leave an image slot unresolved in a brief.** Slot-by-slot
  inventory first; "TBD" ships placeholders.
- **Never skip Checkpoint 1.** Writing briefs before the calendar is
  approved is the largest source of wasted work in this skill.
- **Check `scheduledAt` is in the future** before every HubSpot staging
  call.

---

## Reference

- [reference/design-brief-spec.md](reference/design-brief-spec.md) — the
  design brief template, per-channel dimensions, rendering handoff and
  verification checklist
- [reference/hubspot-staging.md](reference/hubspot-staging.md) — HubSpot
  campaign/Social API and the scheduling CSV for domestic platforms
- [reference/gotchas.md](reference/gotchas.md) — Good / Bad patterns for
  every failure mode this skill has hit in production
- [reference/examples/boutique-brief-campaign.md](reference/examples/boutique-brief-campaign.md)
  — full worked example (single-image note, multi-slot carousel)

## Media publishing routing

- For domestic-platform publishing workflows (公众号/小红书/抖音/视频号 platform adaptation, content compliance review, and publish logging), route to `crabcode-media-ops:media-platform-adapter` and `crabcode-media-ops:media-ops` instead of hand-rolling platform rules here.
- If triggering them returns Unknown skill, the media-ops plugin is not installed: guide the owner to install `crabcode-media-ops` via `/plugin`, then retry. Until then, deliver the publish-ready package for native manual publishing as described above.
