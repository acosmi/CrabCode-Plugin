# Gotchas

Common failure modes for the design-creator skill.

---

## Gotcha: Claiming an asset was generated

**Why it matters:** No design connector ships with this plugin — the
in-house cloud design service (自营云端设计) connector is not yet
available. This skill produces design briefs; only the owner produces
pixels. Presenting a "rendered design," a preview image, or a "generated
asset" that the owner never handed back is fabrication, and it breaks the
Stage 5 attachment step downstream (there is no file).

### ✗ Bad

```
"I've generated the Jun 2 design — here's a preview: [image]"
(No rendered file exists. The 'preview' is invented.)
```

Or any variation: "the design tool returned…", "your asset is ready in
自营云端设计…" — all forbidden until the owner supplies the file.

### ✓ Good

```
"The Jun 2 design brief is approved. Render it in your design tool and
send back the file or a hosted URL — I'll verify it against the brief
and stage the post."
```

An asset exists in this workflow at exactly one moment: when the owner
hands back the rendered file.

---

## Gotcha: Producing a design brief for an email row

**Why it matters:** The owner descoped design work from the email path
entirely. Emails from this skill are text-only — subject, preheader,
body. Writing a design brief for an email row — even "just as a visual
reference" — is a regression of an explicit descope.

### ✗ Bad

```
Calendar has 6 social rows + 2 email rows.
→ Stage 3 writes 6 social briefs + 2 email header briefs.
```

### ✓ Good

```
Stage 1: Calendar built with Path column.
  - 6 rows tagged Design brief (social)
  - 2 rows tagged Text-only (no design work)
Stage 3: Writes exactly 6 briefs. Email rows never enter this stage.
Stage 4: Drafts 6 social captions + 2 full emails (subject + preheader +
         body) as plain text.
Stage 5: Stages/packages 6 social posts. Surfaces 2 emails inline for
         the owner to copy into their email tool.
```

If the owner explicitly asks for a designed email ("can you spec a
header image for the Jun 5 email?"), redirect: "This skill keeps emails
as text-only. If you want a designed email, build the visual in your
design tool and I can help you write the copy here."

---

## Gotcha: Skipping Checkpoint 1 (calendar approval) before writing briefs

**Why it matters:** Writing 10+ design briefs takes time and owner
attention — and the owner then renders them by hand. If the calendar has
the wrong dates, wrong channels, or the owner changes their mind about a
theme, all that work (and any rendering already done) is discarded. The
calendar checkpoint is the cheapest place to catch misalignment.

### ✗ Bad

Receive the brief → immediately write all 12 design briefs → present
them before the owner has agreed on the schedule.

Owner: "Oh wait, I didn't want any posts the week of the 15th, I'm traveling."

### ✓ Good

Present the calendar table first. Wait for explicit "looks good" before
writing a single design brief.

---

## Gotcha: Layout needs more photos than the brief provides

**Why it matters:** Multi-image layouts (小红书 carousels, product grids)
can need 3+ photos. When the content brief gives you 1 photo and the
layout demands 3, a design brief with unresolved slots ("Product2: TBD")
sends the owner into their design tool with nothing to place — they
either stall or ship a stock placeholder.

### ✗ Bad

Build the manifest with one row per asset ("Carousel — needs product
photos"). Write the brief with 1 named file and 2 vague slots. Owner
renders slide 1 properly and fills slides 2–3 with stock images.

### ✓ Good

Build the manifest slot-by-slot. Surface the gap explicitly:

```
The Jun 9 carousel layout has 3 image slots. The brief gave me 1 photo
(linen_midi_01.jpg). How should I fill the other 2?

1. Reuse the same photo across all 3 slots
2. You point me at 2 more photos (file paths)
3. Switch to a single-image layout
```

Wait for the owner's choice before writing the brief. Every slot in a
presented brief names a real file.

---

## Gotcha: Staging a post before verifying the rendered asset against its brief

**Why it matters:** Brief approval is not asset approval. The owner
renders by hand — typos in the overlay text, the wrong photo, or the
wrong aspect ratio slip in easily. A staged post with a near-miss asset
goes out wrong, and the error is public.

### ✗ Bad

```
Owner sends back 8 rendered files → attach and stage all 8 immediately.
```

Result: the Jun 9 post publishes with "Sumer linen" in the headline.

### ✓ Good

Run every returned file through the verification checklist in
`design-brief-spec.md`: right photo per slot, overlay text verbatim,
correct dimensions, on-brand colors, no leftover template text. Name any
deviation exactly ("Jun 9 cover uses the denim photo; brief calls for
linen_midi_01.jpg") and ask for a re-render of just that asset. Only
verified assets reach Stage 5.

---

## Gotcha: Routing domestic-platform rows through the HubSpot Social API

**Why it matters:** HubSpot Social can only auto-publish to accounts
connected in HubSpot; 公众号, 小红书, 抖音, and 视频号 cannot be connected.
Calling the Social API for those rows either errors or, worse, stages a
post to the wrong (overseas) channel the owner happens to have connected.

### ✗ Bad

```
POST /marketing/v3/social/posts for the Jun 2 Xiaohongshu row,
channelId guessed from the connected-accounts list.
```

### ✓ Good

Split Stage 5 by channel: rows for HubSpot-connectable accounts are
staged as `SCHEDULED`; 公众号/小红书/抖音/视频号 rows get a publish-ready
package (date/time + final caption + verified asset) plus the scheduling
CSV, logged against the HubSpot campaign for tracking. The owner
publishes natively — 公众号 supports scheduled publishing in its own
editor.

---

## Gotcha: Caption voice drift across a long calendar

**Why it matters:** When drafting 12–20 captions in one pass, the tone tends
to drift — early captions follow the brief's voice markers, later ones slip
into generic marketing copy. Owners notice immediately.

### ✗ Bad

Post 1: "Our handmade candles are the perfect summer gift 🌿" (matches brief: "warm, conversational")
Post 10: "Elevate your ambiance with our artisanal fragrance collection." (corporate drift)

### ✓ Good

Before drafting, anchor on 2–3 voice markers from the brief (e.g., "casual,
friendly, uses light humor"). Re-read the first draft caption before writing
each new one. If the owner flags a voice mismatch on any caption, re-read that
caption and flag it as the recalibration point for the remaining drafts.

---

## Gotcha: Staging HubSpot posts without verifying `scheduledAt` is in the future

**Why it matters:** HubSpot rejects posts with `scheduledAt` in the past with
a validation error. If the calendar was built on an earlier date and the
owner is only now staging, some dates may have passed.

### ✗ Bad

Build calendar on April 1st for June posts → owner approves May 15th → try to
stage without checking → post for "April 30th 10:00 AM" returns 400.

### ✓ Good

Before calling `POST /social/posts`, compare each `scheduledAt` against the
current UTC time. If any post date has passed, surface it: "The post scheduled
for April 30th has already passed. Should I skip it, or reschedule it to next
week?"
