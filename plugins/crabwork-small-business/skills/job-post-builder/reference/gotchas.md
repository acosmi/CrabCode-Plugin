# Gotchas

## 1. Claiming the offer was sent for signature

✗ **Bad:** CrabCode finishes Phase 6 and says "I've sent the offer to the candidate
via 众律宝 — you'll be notified when they sign."

✓ **Good:** CrabCode finalizes the offer letter, presents the cover message, and
says: "The letter is final at [path]. Upload it to 众律宝 and send it yourself —
I can't send it for you yet (the 众律宝 connector is pending)."

**Why it matters:** There is no e-sign connector in this plugin. Claiming a send
happened means the candidate never receives the offer and the owner finds out days
later. The skill's job ends at a signature-ready document plus a clear handoff.

---

## 2. Missing candidate details before finalizing

✗ **Bad:** CrabCode reaches Phase 6, "finalizes" the letter, and hands it off with
`[CANDIDATE FULL NAME]` still blank — then asks afterwards: "By the way, who is
the candidate?"

✓ **Good:** If the user chose signature-ready delivery in Phase 1, collect the
candidate's full name (and email, if it goes in the cover message) before Phase 6
finalization begins — either in Phase 1 or at the end of Phase 5. Never hand off
a letter with a blank signer.

**Why it matters:** A "final" document with the signer missing isn't final — the
owner uploads it to 众律宝, notices the blank, and has to round-trip back. Collect
the details up front so the handoff is one clean step.

---

## 3. Re-asking for context the user already provided

✗ **Bad:** The user says "we need to hire a senior PM, fully remote, $160–180k"
and Phase 1 asks for role title, location, and compensation anyway.

✓ **Good:** Extract role title, location, and compensation from the message, confirm
them in a single sentence, and ask only for the fields that are genuinely missing.

**Why it matters:** The skill explicitly requires "one focused clarifying question
rather than a long form." Redundant questions break trust and slow the workflow.

---

## 4. Silently expanding the user's existing format

✗ **Bad:** The user has a 3-section job post on file. CrabCode produces a 7-section
post based on `references/job-post-structure.md` without asking.

✓ **Good:** Map the user's existing format against the reference, identify missing
sections, and ask one question: "Your existing JD has X and Y — want me to add Z,
or keep your current format?"

**Why it matters:** The user's format is the source of truth. Overriding it silently
may conflict with internal HR or legal standards the user hasn't mentioned.

---

## 5. Inventing compensation figures

✗ **Bad:** No salary range was provided, so CrabCode writes "$120,000–$150,000 DOE"
in the job post or offer letter.

✓ **Good:** If compensation isn't provided, omit the range from the job post entirely.
In the offer letter, use `[ANNUAL SALARY — confirm with HR]` as a bracketed placeholder.

**Why it matters:** Inventing compensation figures creates legal and HR liability.
The skill's instructions are explicit: "Don't invent a range."
