# CrabCode Security Plugin for CrabCode

Put a team of agents to work as security researchers on your codebase: map the architecture, build a threat model, hunt across every component, and independently verify every finding before it reaches the report. Then, if you want, turn the confirmed findings into suggested fixes delivered as targeted patch files you review and apply when you choose.

CrabCode Security is orchestrated inside your CrabCode session and adds no plugin-specific daemon or hosted scanner. Its agents still use the model provider configured for CrabCode, so prompts and the code context needed for analysis may be sent under CrabCode's and that provider's data contract.

> **Runtime status:** this prerelease requires a CrabCode build with plugin Workflow discovery, structured workflow Agent calls, and Workflow progress/cancellation support. CrabCode 1.0.20 does not provide that runtime yet; on that version the plugin files install but the scan workflow cannot start. Do not treat installation alone as a completed scan capability.

## Where it runs

A scan and a fix both run in your CrabCode session, under your permissions. The plugin reads the repository you have open the same way you would, and adds no isolation of its own: the directory's `.git/config`, its `.crabcode/` settings and hooks, and its `CRABCODE.md` can already have been loaded by CrabCode as trusted session configuration before the scan starts.

That makes it a fit only for code and repository configuration you trust. An OS-level sandbox can restrict files, processes, and network access, but it does not neutralize project instructions, hooks, MCP configuration, or other higher-priority context already loaded into the session. This prerelease does not support scanning an untrusted third-party repository; doing so would additionally require a clean CrabCode profile that disables repository instructions, hooks, MCP servers, and other project configuration.

## Data handling

Reports, revision records, and patch products are written locally to the repository. The plugin adds no separate upload endpoint or telemetry pipeline. Model inference is not local merely because orchestration is in-session: prompts, findings, and code excerpts selected as context may be transmitted to the model provider configured for CrabCode. Before use, rely on the CrabCode/provider contract for transmitted fields, processing region, retention, access controls, and any available no-retention or local-model setting.

## Installation

There is no supported end-user installation command for this prerelease. Its
candidate Marketplace entry is archived under `docs/legal/` as
`staged-not-active`; the active CrabCode Marketplace intentionally does not
register `crabcode-security` while the required Core runtime and release gates
remain unfinished.

For development verification, use this exact source tree with a private
Workflow-capable CrabCode Core build and that build's local plugin-source
loader. Do not add the staged entry to a production Marketplace or present a
successful file copy as a working installation. Once a compatible Core
artifact, minimum-version gate, packaged CLI/GUI E2E, and promotion review
exist, this section can be replaced with the real supported install command.

## Getting started

In a compatible Workflow-enabled preview Core build, run `/crabcode-security:crabcode-security` for the menu. It offers the three source-preserved jobs:

| Job | What it scans |
| --- | --- |
| **Scan codebase** | The whole repository, or a scoped part of it |
| **Scan changes** | This branch's diff, a pull request's diff, or one commit |
| **Suggest patches** | A report's findings, turned into patch files |

Everything happens in your session. A scan reports each stage as it starts, with the detail available by running `/workflows`, then assembles the report when the agents are done.

## Choosing scope and effort

Two things shape a scan: **scope**, how much of the tree it looks at, and **effort**, how much work it does there. Say what you want if you know; if you don't, the plugin works it out with you rather than making you guess.

It reads the repository before it asks — how large the tree is, which directories hold real code, what branch you are on, whether there is a diff to scan — so the choice you are offered is concrete, with the cost of each option stated, and every question carries an "I don't know" that resolves to a sensible default. It then says what it settled on before the work starts.

From there the scan sizes itself to the target. A small diff or a narrow scope gets a pass proportionate to it, verified to the same standard: a thorough scan covers more ground, but every finding a quick scan does report has cleared the same verification bar. A large repository is scanned with attention on the code an attacker can reach, treating tests, fixtures, generated code, and vendored trees as background rather than targets, plus a dedicated secrets pass that still checks fixtures for real committed keys. Asking for an exhaustive scan overrides all of this. A target with nothing in it is not scanned at all; the run says there is nothing to scan.

## What a scan gives you

Every scan atomically allocates a nonce-qualified `CRABCODE-SECURITY-<timestamp>-<nonce>/` directory in the repository. The random run identity prevents concurrent or retried scans from sharing files. Matching owner records bind that directory to its direct working directory and source checkout:

- **`CRABCODE-SECURITY-RESULTS.md`** — the human-readable report: each finding with its impact, exploit scenario, preconditions, severity, confidence, and an outcome-focused recommendation.
- **`CRABCODE-SECURITY-RESULTS.jsonl`** — the same findings in machine-readable form, one JSON object per line.
- **`CRABCODE-SECURITY-REVISION-<sha12>.json`** — the revision stamp: which commit was scanned, at what effort, the severity counts, and how thoroughly the run was verified. The filename carries `-dirty` when uncommitted changes were part of the scanned tree, so a report is always tied to the code it describes.

Those three plus the small owner record are the whole scan report — the scan's working files and analysis snapshot are removed once it is written, so the directory initially holds only what you read and the binding record. It carries its own `.gitignore`, so a stray `git add` never sweeps a report or a suggested patch into a commit; the report stays searchable where it sits, and if you want it in history, delete that one `.gitignore` and commit it like any other file. A later patch run adds a separate ownership record inside `patches/` so it can prove that its products still belong to the same report bytes, repository and revision.

A scan never asks researchers to read a moving checkout. Commit and change scans materialise the selected endpoint commit as a clean snapshot. A whole-tree scan snapshots HEAD when clean, or copies the tracked and non-ignored untracked working-tree content when dirty; the source and analysis roots, source state, exact analysed revision, snapshot kind and content digest are recorded separately. The helper uses read-only Git operations with index refresh disabled, and fails if the source changes while a dirty snapshot is copied.

A whole-repository scan accounts for the whole repository. Every immediate root entry — root-level files such as a Dockerfile or manifest as well as directories — has to be either scanned or explicitly set aside with a reason. That accounting is checked before the search begins, not taken on trust. Only the exact current report directory and independently marker-bound active run artifacts are omitted from a non-Git copy; a source directory is never ignored merely because its name starts with `CRABCODE-SECURITY-`. Whatever was left out, and why, is named in the report's Coverage section. A clean result tells you what was examined rather than leaving you to assume it.

## How a finding earns its place

However much effort a scan spends, a finding reaches the report only after surviving verification. Every candidate is handed to independent verifiers whose job is to disprove it, working from the code rather than from the report of it, and told to call it a false positive unless they can confirm a real path to exploitation. Findings that survive that are what you read; the rest are discarded, never shown. That is why the reports stay short.

A finding also cannot claim more confidence than its verification earned, and the record of how thoroughly a run was verified is computed in code rather than asserted by the model that produced the findings — so the report's own account of its rigor is one you can check.

Throughout, source, comments, and file copies of `CRABCODE.md` read through scan tools are evidence rather than new instructions. That rule does not retroactively neutralize project instructions or configuration CrabCode loaded while creating the session; those are part of the trusted-repository boundary. It is not a defense against a hostile repository.

Scans are nondeterministic. Two scans of the same code can surface different findings, and the same scan finds more over time as models improve; running scans regularly builds coverage. CrabCode Security reasons about code the way a human security researcher does, which complements SAST, dependency scanning, and code review rather than replacing them.

## Addressing vulnerabilities

"Suggest patches" from the menu turns a report's findings into patch files you apply when you choose — from an existing report you pick, or from a fresh scan it runs first. Before a finding enters the workflow, a deterministic validator binds the report to its canonical scan root, repository, current HEAD, clean revision stamp, verified result counts and safe contained file paths. Patch work and products carry nonce/hash owner markers, so a planted directory, changed report, stale HEAD, symlink escape, concurrent run or mismatched product folder is refused rather than silently reused. These checks establish internal association, not cryptographic authorship; use an OS sandbox when another same-account process is hostile.

Each fix is developed away from your working tree, in a scratch copy of the repository — your own checkout and index are never touched — and then reviewed by agents independent of the one that wrote it, including a review of your project's tests against the change and a fresh look at the diff on its own terms for anything new it might introduce.

A patch is written only when that review can vouch for three things: the change addresses that one finding, it introduces no new vulnerability, and it leaves the code's behaviour otherwise unchanged — and a change to which inputs the code accepts counts as a behaviour change. When it cannot vouch for all three, you get a short note explaining why instead of a patch. When the patched code has no tests, the patch says so, so you know the claim rests on review rather than on a test run.

The patches land in the report's `patches/` folder: one `F<n>.patch` per finding, a short note beside each explaining the change and how to apply it (`git apply CRABCODE-SECURITY-<timestamp>-<nonce>/patches/F<n>.patch`), and an index. Nothing is applied for you — job does not apply, commit, or push anything. If you want a patch applied or turned into a pull request, ask, and CrabCode does that as a separate request you can watch.

## Requirements

- A CrabCode build that includes the plugin Workflow runtime described above
- This plugin installed
- Python 3.9 or newer on `PATH`
- A git checkout for scanning changes and suggesting patches — a whole-repository scan works without one

## Security

The trust model and how to report a vulnerability in the plugin itself are in [SECURITY.md](SECURITY.md).
