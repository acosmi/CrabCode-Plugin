# Worked Example: Retail Boutique Brief → Campaign

**Business:** Bloom & Thread (蓝缕) — women's clothing boutique, Hangzhou
**Rendering tool:** Owner renders from design briefs (自营云端设计 connector not yet available)
**HubSpot tier:** Marketing Hub Professional (campaign record; no domestic channels connectable in HubSpot Social)
**Brief source:** content-strategy skill output (approved by owner)

---

## Input: Approved brief (summary)

```
Push hard: Linen summer dresses (top seller, trending +22% MoM)
Hold steady: Accessories
Seasonal opportunity: Back-to-school transition (Aug 15 pivot)
Offer: Buy 2 dresses, get 1 accessory free (runs June 1–July 31)
Channels: Xiaohongshu (小红书), WeChat Official Account (公众号), WeChat Channels (视频号)
Cadence: 3× per week, Mon/Wed/Fri, 10 AM
Voice: Warm, conversational, light humor. No corporate copy.
```

---

## Stage 1: Posting calendar (presented for approval)

| Date | Channel | Path | Theme | Asset type | Caption angle |
|------|---------|------|-------|------------|---------------|
| Jun 2 | Xiaohongshu | Design brief (social) | Linen dresses launch | 3:4 note image | Product intro — "finally, a dress you can wear to both places" |
| Jun 4 | 公众号 | Design brief (social) | Linen dresses | Article cover (900×383) | Social proof — "our most-reached-for item this spring" |
| Jun 6 | 视频号 | Design brief (social) | Buy 2 get 1 offer | Vertical cover (1080×1920) | Offer urgency |
| Jun 9 | Xiaohongshu | Design brief (social) | Linen styling tip | 3-page carousel (3:4) | Education — "3 ways to style the linen midi" |
| Jun 11 | 公众号 | Design brief (social) | Behind the scenes | Article cover (900×383) | Brand story — how they're made |
| Jun 13 | 视频号 | Design brief (social) | Weekend outfit inspo | Vertical cover (1080×1920) | Lifestyle — "your Saturday, sorted" |
| … | … | … | … | … | … |

*Owner approved — "move Jun 11 to Jun 12, I'm posting about the sale that day. Otherwise great."*
*(Calendar updated; proceeding to Stage 2.)*

---

## Stage 2: Asset inventory (slot-by-slot)

**Gap resolution exchange (multi-slot carousel):**

```
CrabCode: The Jun 9 styling carousel has 3 image slots (one per page).
        The brief gave me 1 photo (~/photos/linen_midi_01.jpg). How
        should I fill the other 2?
          1. Reuse the same photo across all 3 pages
          2. You point me at 2 more photos (file paths)
          3. Switch to a single-image note

Owner: Use linen_midi_02.jpg and linen_midi_belt.jpg from the same folder.

CrabCode: Got it — manifest updated, all slots resolved.
```

---

## Stage 3: Design briefs + rendering handoff

**Sample brief (Jun 2, presented for approval):**

```
DESIGN BRIEF — Jun 2 · Xiaohongshu
Asset type:   Note cover image
Dimensions:   1242×1660 (3:4)
Layout:       Full-bleed product photo; headline in the top third on a
              cream panel; CTA line bottom-left.
Text overlay:
  Headline:   "Finally, a dress for both places"
  Subhead:    —
  CTA:        "New linen midi · in store & online"
Images:
  Cover:      ~/photos/linen_midi_01.jpg
Brand:
  Colors:     Cream #F5EFE6, deep green #2E4B3F
  Fonts:      Owner's brand font (思源宋体 fallback)
Style notes:  Warm, airy, lots of whitespace. No starbursts, no discount
              badges on this one — launch post, not offer post.
Export:       PNG, 1242×1660
```

*Owner approved all 6 briefs. Handoff:*

```
All 6 design briefs are approved. Render them in your design tool and
send back the files or hosted URLs — I'll verify each against its brief
and stage the campaign.
```

**Verification (files returned):**

```
✓ Jun 2  xhs_launch.png      — matches brief
✓ Jun 4  gzh_cover_proof.png — matches brief
✗ Jun 9  carousel_p2.png     — page 2 uses linen_midi_01.jpg again;
                               brief calls for linen_midi_02.jpg.
                               Re-render just this page?
```

*Owner re-rendered page 2; all assets verified.*

---

## Stage 4: Caption drafts

**Jun 2 — Xiaohongshu (linen dresses launch)**
```
Title: 一条裙子，市集和晚餐都能穿

Finally, a dress you can wear to the farmer's market *and* to dinner. 🌿

Our linen midi just landed and it's already our most-requested piece this
summer. Breathable, effortless, and yes — it has pockets.

Sizes go fast — come try it on at the Wulin Road store, or order in the
mini program.

#亚麻连衣裙 #杭州穿搭 #夏日通勤 #蓝缕
```

**Jun 4 — 公众号 (social proof)**
```
"I've worn it four times this week and I'm not even sorry."

That's a real review from a real customer about our linen midi. Between
you and us, we're not surprised. Shop the collection at the link below.
```

**Jun 6 — 视频号 (offer)**
```
👗 Buy 2 dresses → get 1 accessory FREE

Offer runs June 1–July 31. Don't sleep on it.

Tap through to shop →
```

*Owner approved with one change: "Jun 4 caption — add the price at the end. '¥488, link below.'"*
*Caption updated.*

---

## Stage 5: HubSpot staging + publish packages

**Campaign created:**
```
Campaign: "Bloom & Thread — Summer Linen 2026"
Start: Jun 2, 2026 | End: Jul 31, 2026
Campaign ID: 8a72c1f4...
```

All channels in this campaign are domestic platforms, which HubSpot Social
cannot publish to — so no posts are staged via the Social API. Instead,
each row gets a publish-ready package logged against the campaign, plus
one scheduling CSV.

**Publish schedule (first 3):**

| Publish at | Channel | Caption preview | Asset | Status |
|-----------|---------|-----------------|-------|--------|
| Jun 2, 10:00 | Xiaohongshu | "Finally, a dress you can wear…" | xhs_launch.png ✓ | Ready to publish |
| Jun 4, 10:00 | 公众号 | '"I've worn it four times…"' | gzh_cover_proof.png ✓ | Ready to publish |
| Jun 6, 10:00 | 视频号 | "Buy 2 dresses → get 1 accessory FREE…" | sph_offer_cover.png ✓ | Ready to publish |

**Final message to owner:**
```
Campaign is set up in HubSpot for tracking:
https://app.hubspot.com/marketing/12345/campaigns/8a72c1f4

The scheduling CSV and publish packages are ready — you publish each
post natively (公众号 posts can be scheduled inside the 公众号 editor).
Want me to message this schedule to you on Feishu? Anything to change
before we're done?
```

---

## Email content example (text-only — no design work)

Email rows skip the design-brief stage entirely. CrabCode writes the email
subject, preheader, and body as plain prose in Stage 4, and the owner
copies the content into their email tool when they're ready to send —
there is no email connector, so nothing is sent from this skill.

**Calendar row:**

| Date | Channel | Path | Theme | Asset type | Angle |
|------|---------|------|-------|------------|-------|
| Jun 5 | Email | Text-only | Summer linen launch | Email (text) | Hero customer benefit + offer |

**Stage 4 output (inline, no design work involved):**

```
Subject: Linen that actually breathes
Preheader: New summer styles in — plus a small gift if you grab two.

The first batch of linen midis just hit the floor. They're the kind of
dress you can wear to brunch, to a wedding, or to the school pickup line
without feeling like you've made a wardrobe decision.

A few things worth knowing:
  • Sizes XS–XL, four colorways
  • Pockets (real ones)
  • Buy 2 dresses through July 31 and we'll throw in a free accessory

Stop by the Wulin Road store this weekend, or order in the mini program.

Shop the linen collection →

— Maya
Bloom & Thread 蓝缕
```

**Stage 5 handoff:**

```
Publish packages for the social posts are ready above.

Email content for June 5 is drafted above — copy it into your email tool
when you're ready to send. We don't stage emails directly; that lets you
preview the formatting in your sending platform first.
```
