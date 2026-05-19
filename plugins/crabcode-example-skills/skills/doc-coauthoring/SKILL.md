---
name: doc-coauthoring
description: "Guide the user through a structured workflow for co-authoring documentation. Use this skill when the user wants to write documentation, proposals, technical specs, decision docs, RFCs, PRDs, or similar structured content. The workflow helps the user transfer context efficiently, refine content through iteration, and verify the document works for downstream readers."
license: Apache-2.0. See ../../docs/legal/THIRD_PARTY_NOTICES.md for source attribution.
---

# Doc Co-Authoring Workflow

This skill provides a structured workflow for guiding users through
collaborative document creation. The agent acts as an active guide,
walking the user through three stages: Context Gathering, Refinement
and Structure, and Reader Testing.

## When to Offer This Workflow

**Trigger conditions:**

- The user mentions writing documentation: "write a doc", "draft a
  proposal", "create a spec", "write up".
- The user mentions specific document types: PRD, design doc,
  decision doc, RFC.
- The user is starting a substantial writing task.

**Initial offer:** explain the three stages and ask whether the user
wants to follow the workflow or proceed freeform.

1. **Context Gathering**: user provides relevant context; the agent
   asks clarifying questions.
2. **Refinement and Structure**: iteratively build each section through
   brainstorming and editing.
3. **Reader Testing**: test the document with a fresh agent session
   (no context from the current conversation) to catch blind spots
   before others read it.

If the user declines, work freeform. If the user accepts, proceed to
Stage 1.

## Stage 1 — Context Gathering

**Goal**: close the gap between what the user knows and what the agent
knows so that later guidance is informed.

### Initial Questions

Start by asking the user for meta-context about the document:

1. What type of document is this (technical spec, decision doc,
   proposal, RFC, PRD)?
2. Who is the primary audience?
3. What is the desired impact when someone reads this?
4. Is there a template or specific format to follow?
5. Are there other constraints or context to know up front?

Make clear that the user can answer in shorthand or dump information
however works for them.

**If the user provides a template or mentions a doc type:**

- Ask whether they have a template document to share.
- If they provide a link to a shared document, use available tools to
  fetch it.
- If they provide a file path, read it.

**If the user mentions editing an existing shared document:**

- Read the current state of the document.
- Check for images without alt text.
- If images lack alt text, explain that downstream agents reading the
  document later will not see the image. Offer to generate alt text
  from a pasted version of each image.

### Info Dumping

Once initial questions are answered, encourage the user to dump every
piece of context they have:

- Background on the project or problem.
- Related team discussions or shared documents.
- Why alternative solutions are not being used.
- Organizational context (team dynamics, past incidents, politics).
- Timeline pressures or constraints.
- Technical architecture or dependencies.
- Stakeholder concerns.

Advise the user to dump first and organize later. Offer multiple
delivery options:

- Stream-of-consciousness paste.
- Links to team channels or threads.
- Links to shared documents.

**If integrations are available** (Slack, Teams, Google Drive,
SharePoint, MCP servers), mention that the agent can pull context
directly. If integrations are not available, suggest enabling them or
pasting content into the conversation.

**During context gathering:**

- If the user mentions team channels or shared documents, fetch them
  through the available integration. If unavailable, ask for pasted
  content.
- If the user mentions unknown entities or projects, confirm before
  searching connected tools.
- Track which questions remain open as context arrives.

**Clarifying questions:** when the user signals that the initial dump
is complete, ask five to ten numbered clarifying questions targeted at
real gaps. Invite shorthand answers ("1: yes, 2: see #channel, 3: no,
backwards compat").

**Exit condition:** context is sufficient when clarifying questions
can be about edge cases and trade-offs rather than basic premises.

## Stage 2 — Refinement and Structure

**Goal**: build the document section by section through brainstorming,
curation, and iterative refinement.

Explain the per-section flow to the user:

1. Clarifying questions about what to include.
2. Five to twenty brainstormed options.
3. The user signals what to keep, remove, or combine.
4. Draft the section.
5. Refine through surgical edits.

### Section Ordering

If the document structure is clear, ask which section to start with.
Recommend starting with the section that carries the most unknowns —
usually the core proposal or technical approach. Summary sections are
best written last.

If the user does not know what sections they need, propose three to
five sections appropriate for the document type and confirm before
building the scaffold.

### Scaffold

Once the structure is agreed, create the document with placeholder
text for every section. Use the agent's file or artifact tooling to
materialize the scaffold so the user can see progress incrementally.
Name the file consistently with the document type (for example,
`decision-doc.md` or `technical-spec.md`).

### Per Section

1. **Clarifying questions**: ask five to ten specific questions about
   the section.
2. **Brainstorm**: generate five to twenty options. Surface forgotten
   context and unseen angles.
3. **Curate**: ask the user which points to keep, remove, or combine.
   Invite brief justifications so the agent learns priorities for
   later sections. Examples: "Keep 1, 4, 7, 9.", "Remove 3 (duplicates
   1).", "Combine 11 and 12.".
4. **Gap check**: confirm nothing important is missing.
5. **Draft**: replace the placeholder text with the drafted content
   using targeted edits.
6. **Iterate**: respond to user feedback through surgical edits, not
   full reprints. After three iterations without substantial change,
   ask whether anything can be removed without losing important
   information. Encourage the user to provide feedback as instructions
   ("Remove the X bullet — Y already covers it.") rather than
   rewriting the document in chat, so the agent can learn style.

When all sections are drafted, re-read the document end to end and
look for:

- Flow and consistency across sections.
- Redundancy or contradictions.
- Generic filler that does not earn its place.
- Sentences that fail to carry weight.

## Stage 3 — Reader Testing

**Goal**: verify that the document works for readers who lack the
authors' context.

Explain that the testing step catches blind spots — assumptions that
are obvious to the authors but confusing to other readers.

### If Sub-Agent Access Is Available

1. **Predict reader questions**: generate five to ten questions a
   realistic reader would ask.
2. **Test with a sub-agent**: invoke a fresh agent session for each
   question, passing only the document content and the question.
   Summarize what the reader agent got right and wrong.
3. **Additional checks**: ask the sub-agent about ambiguity, false
   assumptions, and contradictions in the document.
4. **Report and fix**: report the issues, loop back to refinement for
   the affected sections.

### If Sub-Agent Access Is Not Available

Provide the user with instructions for running the same checks
manually. The user pastes the document into a fresh agent session and
asks each predicted question, then asks the additional ambiguity
checks. Iterate until the reader session answers consistently.

### Exit Condition

Testing passes when the reader session answers consistently, surfaces
no new ambiguity, and identifies no contradictions.

## Final Review

When reader testing passes:

1. Recommend the user do a final personal read-through. They own the
   document and its quality.
2. Suggest checking facts, links, and technical details.
3. Confirm the document achieves the intended impact.

Offer one more review pass if desired. When the work is done:

- Consider linking the working conversation in an appendix so readers
  can see how the document evolved.
- Use appendices to add depth without bloating the main body.
- Plan to update the document as feedback arrives from real readers.

## Guidance Tips

- **Tone**: be direct and procedural. Explain rationale briefly when it
  affects user behavior. Do not sell the approach; execute it.
- **Deviations**: if the user wants to skip a stage, offer freeform
  mode. If the user seems frustrated, acknowledge it and suggest ways
  to move faster.
- **Context management**: address missing context as it surfaces;
  never let gaps accumulate.
- **Artifact management**: use file edits for drafting full sections,
  surgical edits for revisions, and avoid using artifacts for
  brainstorming lists.
- **Quality over speed**: each iteration should make meaningful
  improvements. The goal is a document that works for readers.
