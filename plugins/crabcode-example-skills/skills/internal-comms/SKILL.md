---
name: internal-comms
description: "A workflow for writing all kinds of internal communications using formats common in modern teams. Use this skill when the user asks for an internal communication artifact such as a 3P update (Progress, Plans, Problems), a company newsletter, an FAQ response, a status report, a leadership update, a project update, or an incident report."
license: Apache-2.0. See ../../docs/legal/THIRD_PARTY_NOTICES.md for source attribution.
---

# Internal Communications

## When to Use

Use this skill for internal communication formats:

- 3P updates (Progress, Plans, Problems).
- Company newsletters.
- FAQ responses.
- Status reports.
- Leadership updates.
- Project updates.
- Incident reports.

## How to Use

To write any internal communication:

1. Identify the communication type from the user's request.
2. Load the matching guideline file from the `examples/` directory:
   - `examples/3p-updates.md` — Progress, Plans, Problems team updates.
   - `examples/company-newsletter.md` — company-wide newsletters.
   - `examples/faq-answers.md` — answering frequently asked questions.
   - `examples/general-comms.md` — anything else that does not match
     the above.
3. Follow the specific instructions in that file for formatting,
   tone, and content gathering.

If the communication type does not match any guideline file, ask the
user for clarification or more context about the desired format.

## Keywords

3P updates, company newsletter, weekly update, FAQ, common questions,
status, project updates, incident report, internal comms.
