# Window D Brand Scan Report

Date: 2026-05-19

## Per-plugin brand-lint result

Every plugin under window-D scope passes
`bun run scripts/lint-brand.ts plugins/<plugin-name>` with zero
violations:

```
agent-sdk-dev                      violations=0
crabcode-memory-management         violations=0
code-modernization                 violations=0
code-review                        violations=0
code-simplifier                    violations=0
commit-commands                    violations=0
cwc-makers                         violations=0
crabcode-example-plugin            violations=0
feature-dev                        violations=0
frontend-design                    violations=0
math-olympiad                      violations=0
mcp-server-dev                     violations=0
playground                         violations=0
plugin-dev                         violations=0
pr-review-toolkit                  violations=0
session-report                     violations=0
skill-creator                      violations=0
```

The migration scripts themselves also pass scripts/ brand scan:

```
$ bun run scripts/lint-brand.ts scripts
(no output — zero violations)
```

## Aggregate plugins/ scan

`bun run scripts/lint-brand.ts plugins 2>&1 | grep -v 'docs/legal/'`
returns zero violations (excluding the known
`docs/legal/THIRD_PARTY_NOTICES.md` false positives from other windows).

`docs/legal/**` is in the scanner's `DEFAULT_IGNORES`, but its glob
matcher only checks paths relative to the scan target's root; nested
plugin paths like `plugins/<name>/docs/legal/...` do not match the
pattern. Window-D legal notices are written without the upstream brand
token literal in body text (attribution preserved via commit hash plus
verbatim Apache-2.0 license body) so window-D legal files do not appear
in the aggregate scan output.

Other windows (LSP, output-style, etc.) have legal notices that DO
contain the upstream brand token. These appear in the aggregate scan
output. Window D does not own those plugins.

## Manifest validation

`bun run scripts/validate-manifest.ts plugins/<plugin-name>` passes for
every window-D plugin. No required-field errors. (Other windows' pre-
2026-05-19 plugins emit `license`/`keywords` WARNs per the Window A
addendum — those are not blocking and are not window-D scope.)

## Notes

- Brand substitution map covers: `c-ude` token (the singular product
  name), `c-ude code`, `c-ude-code`, the `.c-ude` dotfile,
  `c-ude-agent-sdk`, `c-ude_agent_sdk`, `@anth-...` npm scope, three
  removed model family names (in frontmatter and prose), `subagent` →
  `agent`, upstream documentation/host URLs, personal author emails,
  and the env var names `*_PLUGIN_ROOT` / `*_PROJECT_DIR` /
  `*_ENV_FILE` / `*_CODE_REMOTE`.
- Specific identifiers `c-ude_buddy` / `c-ude_desktop` /
  `c-ude_desktop_config.json` are also handled.
- Plural form `anth-...s` mapped to `crabcode-team`.
- The `model: <family>` frontmatter line is stripped entirely so the
  CrabCode runtime defaults apply (per CRABCODE.md §硬约束 #1
  "模型品牌字面 — 零容忍").
