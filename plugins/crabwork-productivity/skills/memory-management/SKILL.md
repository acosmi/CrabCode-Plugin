---
name: 工作记忆管理
short-description: 整理长期记忆、会话上下文与可复用知识，保持信息易于检索
description: Two-tier workplace memory that decodes the shorthand, acronyms, nicknames, and project codenames in a user's requests so they are understood like a colleague would. Use whenever a request contains an unfamiliar name, initialism, or codename to look up (e.g. "ask todd about the PSR for phoenix"); when the user says "remember this", "X means Y", "who is X", or "what does X stand for"; when capturing a person's role, a project's details, or a preference for later; or when promoting frequently-used terms into working memory and demoting stale ones. Working memory lives in CRABCODE.md (the hot cache), full knowledge base in the memory/ directory.
user-invocable: false
---

# Memory Management

Memory makes CrabCode your workplace collaborator - someone who speaks your internal language.

## The Goal

Transform shorthand into understanding:

```
User: "ask todd to do the PSR for oracle"
              ↓ CrabCode decodes
"Ask Todd Martinez (Finance lead) to prepare the Pipeline Status Report
 for the Oracle Systems deal ($2.3M, closing Q2)"
```

Without memory, that request is meaningless. With memory, CrabCode knows:
- **todd** → Todd Martinez, Finance lead, prefers Slack
- **PSR** → Pipeline Status Report (weekly sales doc)
- **oracle** → Oracle Systems deal, not the company

## Architecture

```
CRABCODE.md          ← Hot cache (~30 people, common terms)
memory/
  glossary.md      ← Full decoder ring (everything)
  people/          ← Complete profiles
  projects/        ← Project details
  context/         ← Company, teams, tools
```

**CRABCODE.md (Hot Cache):**
- Top ~30 people you interact with most
- ~30 most common acronyms/terms
- Active projects (5-15)
- Your preferences
- **Goal: Cover 90% of daily decoding needs**

**memory/glossary.md (Full Glossary):**
- Complete decoder ring - everyone, every term
- Searched when something isn't in CRABCODE.md
- Can grow indefinitely

**memory/people/, projects/, context/:**
- Rich detail when needed for execution
- Full profiles, history, context

## Lookup Flow

```
User: "ask todd about the PSR for phoenix"

1. Check CRABCODE.md (hot cache)
   → Todd? ✓ Todd Martinez, Finance
   → PSR? ✓ Pipeline Status Report
   → Phoenix? ✓ DB migration project

2. If not found → search memory/glossary.md
   → Full glossary has everyone/everything

3. If still not found → ask user
   → "What does X mean? I'll remember it."
```

This tiered approach keeps CRABCODE.md lean (~100 lines) while supporting unlimited scale in memory/.

## File Locations

- **Working memory:** `CRABCODE.md` in current working directory
- **Deep memory:** `memory/` subdirectory

## Working Memory Format (CRABCODE.md)

Use tables for compactness. Target ~50-80 lines total.

```markdown
# Memory

## Me
[Name], [Role] on [Team]. [One sentence about what I do.]

## People
| Who | Role |
|-----|------|
| **Todd** | Todd Martinez, Finance lead |
| **Sarah** | Sarah Chen, Engineering (Platform) |
| **Greg** | Greg Wilson, Sales |
→ Full list: memory/glossary.md, profiles: memory/people/

## Terms
| Term | Meaning |
|------|---------|
| PSR | Pipeline Status Report |
| P0 | Drop everything priority |
| standup | Daily 9am sync |
→ Full glossary: memory/glossary.md

## Projects
| Name | What |
|------|------|
| **Phoenix** | DB migration, Q2 launch |
| **Horizon** | Mobile app redesign |
→ Details: memory/projects/

## Preferences
- 25-min meetings with buffers
- Async-first, Slack over email
- No meetings Friday afternoons
```

## Deep Memory Format (memory/)

**memory/glossary.md** - The decoder ring:
```markdown
# Glossary

Workplace shorthand, acronyms, and internal language.

## Acronyms
| Term | Meaning | Context |
|------|---------|---------|
| PSR | Pipeline Status Report | Weekly sales doc |
| OKR | Objectives & Key Results | Quarterly planning |
| P0/P1/P2 | Priority levels | P0 = drop everything |

## Internal Terms
| Term | Meaning |
|------|---------|
| standup | Daily 9am sync in #engineering |
| the migration | Project Phoenix database work |
| ship it | Deploy to production |
| escalate | Loop in leadership |

## Nicknames → Full Names
| Nickname | Person |
|----------|--------|
| Todd | Todd Martinez (Finance) |
| T | Also Todd Martinez |

## Project Codenames
| Codename | Project |
|----------|---------|
| Phoenix | Database migration |
| Horizon | New mobile app |
```

**memory/people/{name}.md:**
```markdown
# Todd Martinez

**Also known as:** Todd, T
**Role:** Finance Lead
**Team:** Finance
**Reports to:** CFO (Michael Chen)

## Communication
- Prefers Slack DM
- Quick responses, very direct
- Best time: mornings

## Context
- Handles all PSRs and financial reporting
- Key contact for deal approvals over $500k
- Works closely with Sales on forecasting

## Notes
- Cubs fan, likes talking baseball
```

**memory/projects/{name}.md:**
```markdown
# Project Phoenix

**Codename:** Phoenix
**Also called:** "the migration"
**Status:** Active, launching Q2

## What It Is
Database migration from legacy Oracle to PostgreSQL.

## Key People
- Sarah - tech lead
- Todd - budget owner
- Greg - stakeholder (sales impact)

## Context
$1.2M budget, 6-month timeline. Critical path for Horizon project.
```

**memory/context/company.md:**
```markdown
# Company Context

## Tools & Systems
| Tool | Used for | Internal name |
|------|----------|---------------|
| Slack | Communication | - |
| Asana | Engineering tasks | - |
| Salesforce | CRM | "SF" or "the CRM" |
| Notion | Docs/wiki | - |

## Teams
| Team | What they do | Key people |
|------|--------------|------------|
| Platform | Infrastructure | Sarah (lead) |
| Finance | Money stuff | Todd (lead) |
| Sales | Revenue | Greg |

## Processes
| Process | What it means |
|---------|---------------|
| Weekly sync | Monday 10am all-hands |
| Ship review | Thursday deploy approval |
```

## How to Interact

### Decoding User Input (Tiered Lookup)

**Always** decode shorthand before acting on requests:

```
1. CRABCODE.md (hot cache)     → Check first, covers 90% of cases
2. memory/glossary.md        → Full glossary if not in hot cache
3. memory/people/, projects/ → Rich detail when needed
4. Ask user                  → Unknown term? Learn it.
```

Example:
```
User: "ask todd to do the PSR for oracle"

CRABCODE.md lookup:
  "todd" → Todd Martinez, Finance ✓
  "PSR" → Pipeline Status Report ✓
  "oracle" → (not in hot cache)

memory/glossary.md lookup:
  "oracle" → Oracle Systems deal ($2.3M) ✓

Now CrabCode can act with full context.
```

### Adding Memory

When user says "remember this" or "X means Y":

1. **Glossary items** (acronyms, terms, shorthand):
   - Add to memory/glossary.md
   - If frequently used, add to CRABCODE.md Quick Glossary

2. **People:**
   - Create/update memory/people/{name}.md
   - Add to CRABCODE.md Key People if important
   - **Capture nicknames** - critical for decoding

3. **Projects:**
   - Create/update memory/projects/{name}.md
   - Add to CRABCODE.md Active Projects if current
   - **Capture codenames** - "Phoenix", "the migration", etc.

4. **Preferences:** Add to CRABCODE.md Preferences section

### Recalling Memory

When user asks "who is X" or "what does X mean":

1. Check CRABCODE.md first
2. Check memory/ for full detail
3. If not found: "I don't know what X means yet. Can you tell me?"

### Progressive Disclosure

1. Load CRABCODE.md for quick parsing of any request
2. Dive into memory/ when you need full context for execution
3. Example: drafting an email to todd about the PSR
   - CRABCODE.md tells you Todd = Todd Martinez, PSR = Pipeline Status Report
   - memory/people/todd-martinez.md tells you he prefers Slack, is direct

## Bootstrapping

Use `/crabwork-productivity:start` to initialize by scanning your chat, calendar, email, and documents. Extracts people, projects, and starts building the glossary.

## Conventions

- **Bold** terms in CRABCODE.md for scannability
- Keep CRABCODE.md under ~100 lines (the "hot 30" rule)
- Filenames: lowercase, hyphens (`todd-martinez.md`, `project-phoenix.md`)
- Always capture nicknames and alternate names
- Glossary tables for easy lookup
- When something's used frequently, promote it to CRABCODE.md
- When something goes stale, demote it to memory/ only

## What Goes Where

| Type | CRABCODE.md (Hot Cache) | memory/ (Full Storage) |
|------|----------------------|------------------------|
| Person | Top ~30 frequent contacts | glossary.md + people/{name}.md |
| Acronym/term | ~30 most common | glossary.md (complete list) |
| Project | Active projects only | glossary.md + projects/{name}.md |
| Nickname | In Key People if top 30 | glossary.md (all nicknames) |
| Company context | Quick reference only | context/company.md |
| Preferences | All preferences | - |
| Historical/stale | ✗ Remove | ✓ Keep in memory/ |

## Promotion / Demotion

**Promote to CRABCODE.md when:**
- You use a term/person frequently
- It's part of active work

**Demote to memory/ only when:**
- Project completed
- Person no longer frequent contact
- Term rarely used

This keeps CRABCODE.md fresh and relevant.
