---
name: review-contract
version: 0.3.0
description: Reviews a contract in plain English, surfaces red flags with severity ratings, and produces a marked-up docx/PDF with suggested redlines. Trigger when the owner runs /review-contract or says "review this contract," "what am I signing," "should I sign this," "check this NDA/MSA/agreement," "any red flags in this," "look at these terms," or uploads/pastes a contract or legal document. Accepts an optional file path; works fully offline with a local file or pasted text (no email or e-sign connector yet).
allowed-tools: Read, WebFetch, Bash
---

Run the contract review. Read the document, explain what it says, flag anything risky, and produce marked-up redlines for the owner to use in negotiations.

Parse arguments:
- `FILE_PATH` — path to a local PDF/docx file; if omitted, ask the owner to attach the contract or paste the text. There is no email or e-sign connector yet (腾讯企业邮 and 众律宝 are pending), so the contract always comes from the owner directly.

## Step 1 — Load the contract

Using the `contract-review` skill workflow:

1. If a file path is given: read the document from Files or Desktop.
2. If the owner pasted the contract text: work with what's provided.
3. If neither: ask the owner to attach the contract as a PDF or docx, or paste the text. If it lives in their inbox or an e-sign service, they download it and attach it — the skill cannot fetch it.

## Step 2 — Plain-English summary

Produce a 3-paragraph summary:
1. **What this contract does** — the deal in plain terms (who, what, how much, how long)
2. **Key obligations** — what the owner must do and when
3. **Key rights** — what the owner gets and any termination or exit paths

## Step 3 — Red-flag list

For each risk, rate severity: 🔴 High / 🟡 Medium / 🟢 Low

Flag at minimum:
- Auto-renewal clauses with short cancellation windows
- Unilateral price change rights
- Broad IP ownership transfers
- Unlimited liability or missing liability cap
- Exclusivity clauses
- Non-compete or non-solicit provisions
- Ambiguous payment or deliverable terms

Format each flag as:
```
{Severity} {Clause name} — {what it says in plain English} — Suggested redline: {fix}
```

## Step 4 — Marked-up redlines

Generate a list of specific redline suggestions in legal markup format:
```
§{section}: DELETE "[original language]" / INSERT "[suggested replacement]"
Reason: {one sentence}
```

Offer to export this as a marked-up docx or PDF to Files or Desktop.

## Connector failures

This command works fully offline — it needs no connectors. If no file path was given and nothing was pasted, ask the owner to upload the contract as a PDF or docx. Sending the redline to the counterparty and routing the final document for signature are the owner's manual steps: 众律宝 (connector pending) or paper.

## Approval gates

- **Never claim to send, sign, or route anything for signature.** Prepare the final document; the owner sends it for signature via 众律宝 (or on paper) manually.
- **Always caveat:** "This is not legal advice. Review with your attorney before signing."
- **Never delete or overwrite the original document.**

## Output

Present the plain-English summary, red-flag list, and redline suggestions. Ask the owner whether to export a marked-up copy and where to save it.
