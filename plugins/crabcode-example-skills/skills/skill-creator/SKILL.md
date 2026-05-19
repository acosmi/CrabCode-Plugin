---
name: skill-creator
description: "Create new agent skills, modify and improve existing ones, and measure skill performance. Use this skill when the user wants to write a skill from scratch, edit or optimize an existing skill, run evaluations against a skill, benchmark skill performance with variance analysis, or tune a skill description for better triggering accuracy."
license: Apache-2.0. See ../../docs/legal/THIRD_PARTY_NOTICES.md for source attribution.
---

# Skill Creator

This skill helps create new agent skills and iteratively improve
existing ones.

## High-Level Process

1. Decide what the skill should do and roughly how it will do it.
2. Write a draft of the skill.
3. Create a small set of test prompts and run them against an agent
   that has access to the skill.
4. Help the user evaluate the results qualitatively and quantitatively.
5. Rewrite the skill based on feedback from evaluation and from any
   glaring flaws surfaced by quantitative benchmarks.
6. Repeat until satisfied.
7. Expand the test set and run again at larger scale.

The agent's job is to figure out where the user is in this process and
help them progress through these stages. If the user already has a
draft, jump straight to evaluation and iteration. If the user prefers
to skip evaluations and "vibe with it", do that.

After the skill is in a good place, optionally run a description
improver to tune the triggering surface.

## Communicating With the User

Skill authors range from career engineers to first-time terminal users.
Pay attention to context cues and calibrate vocabulary accordingly.
Brief inline definitions are fine when in doubt. Treat `evaluation` and
`benchmark` as borderline jargon; explain `JSON` and `assertion` unless
the user already shows familiarity.

## Creating a Skill

### Capture Intent

Start by understanding the user's intent. The current conversation may
already contain a workflow the user wants to capture (for example,
they say "turn this into a skill"). When that is the case, extract
answers from the conversation history first: the tools used, the
sequence of steps, corrections the user made, the input and output
formats observed.

Ask follow-up questions to confirm:

1. What should this skill enable the agent to do?
2. When should the skill trigger (user phrases, context cues)?
3. What is the expected output format?
4. Should test cases be set up to verify the skill works? Skills with
   verifiable outputs (file transforms, data extraction, code
   generation, fixed workflow steps) benefit from tests. Skills with
   subjective outputs (writing style, art) often do not.

### Interview and Research

Proactively ask about edge cases, input and output formats, example
files, success criteria, and dependencies. Wait to write test prompts
until these are settled.

Check available MCP servers and existing skills. If useful research
exists (similar skills, best practices, target service docs), do it in
parallel via sub-agents when available, otherwise inline. Show up
prepared so the user does not have to surface every fact.

### Write the SKILL.md

Based on the interview, fill in:

- **name**: skill identifier (kebab-case, same as the folder name).
- **description**: when to trigger and what the skill does. This is
  the primary triggering mechanism — include both behavior and
  contexts. Lean slightly "pushy" to combat undertriggering. For
  example, instead of "Build a dashboard to display internal data",
  write "Build a dashboard to display internal data. Use this skill
  whenever the user mentions dashboards, data visualization, internal
  metrics, or wants to display any kind of company data, even if they
  do not explicitly ask for a dashboard."
- **compatibility**: required tools or dependencies, only when
  non-trivial.
- The rest of the skill body.

### Anatomy of a Skill

```text
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter (name, description required)
│   └── Markdown instructions
└── Bundled resources (optional)
    ├── scripts/     Executable code for deterministic, repetitive tasks
    ├── references/  Docs loaded into context as needed
    └── assets/      Files used in output (templates, icons, fonts)
```

### Progressive Disclosure

Skills use a three-level loading system:

1. **Metadata** (name and description) — always in context, roughly
   one hundred words.
2. **SKILL.md body** — loaded whenever the skill triggers. Target
   under five hundred lines.
3. **Bundled resources** — loaded on demand. Scripts can execute
   without ever entering the context.

Patterns:

- Keep `SKILL.md` under five hundred lines. When approaching the
  limit, add another layer of hierarchy and point clearly at the
  follow-up file.
- Reference files explicitly and explain when to read them.
- For large reference files (more than three hundred lines), include a
  table of contents.

**Domain organization.** When a skill spans multiple domains or
frameworks, organize by variant:

```text
cloud-deploy/
├── SKILL.md      Workflow plus variant selection
└── references/
    ├── aws.md
    ├── gcp.md
    └── azure.md
```

The agent reads only the relevant reference file.

### Principle of Lack of Surprise

Skills must not contain malware, exploit code, or anything that could
compromise system security. A skill's content should match its
described intent. Decline requests to create misleading skills or
skills designed to facilitate unauthorized access, data exfiltration,
or similar misuse. Creative role-play that does not cause harm is
acceptable.

### Writing Patterns

- Prefer the imperative form in instructions.
- Keep examples concrete. Show short, working snippets in place of
  abstract descriptions.
- When defining a structured output format, show the schema and a
  brief example.
- Avoid embedding model-specific or vendor-specific assumptions.

## Evaluating a Skill

### Test Cases

Capture five to ten realistic test prompts that exercise the skill
along its full surface. Cover:

- Happy-path triggers (the skill should run and produce the expected
  output).
- Negative triggers (the skill should not run, even though related
  vocabulary is present).
- Edge cases (unusual input, large input, missing input).

### Run the Tests

Run each prompt against an agent session that has access to the
skill. Capture transcripts. When sub-agent tooling is available, fan
out the runs in parallel so the user is not blocked.

### Analyze Results

Help the user evaluate qualitatively (transcript review) and
quantitatively (success rate against assertions). Use the bundled
`eval-viewer/generate_review.py` script when present to render the
runs for review.

### Iterate

Rewrite the skill based on user feedback and any obvious flaws from
quantitative scores. Re-run the test set. Stop when the user is
satisfied or when quantitative gains plateau.

### Triggering Tuner

After the skill is in a stable place, optionally run the description
improver (bundled under `scripts/` if present). The improver perturbs
the description and measures triggering accuracy across borderline
prompts.

## Bundled Helpers

Skills may include:

- `scripts/` — executable code (TypeScript runtime preferred for new
  CrabCode skills, see plugin-level conventions).
- `references/` — additional context loaded on demand.
- `assets/` — templates, icons, fonts, or other files used in output.
- `eval-viewer/` — tooling for reviewing evaluation runs.

When the skill grows beyond a single workflow, organize bundled
helpers by responsibility and reference each from the main body.

## Final Notes

- Stay flexible. Some users want extensive evaluation; others want a
  quick iteration loop. Match the user's preference.
- Document every non-obvious decision in the SKILL.md body so the
  next maintainer can pick up the thread.
- Keep the skill focused. If a single skill ends up covering more
  than one workflow, split it.
