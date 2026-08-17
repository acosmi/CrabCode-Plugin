# Patch products specification

The shape of what the fix job writes. Three layers: machine-created owner records bind a run to one report/repository/revision; the Security Lead writes the working decision record (`patches.json`); and `patch_artifacts.py` renders products from that record plus the raw diffs Git wrote. This mirrors `report-spec.md`: the model narrates and decides, while the script owns filesystem paths and copies diff bytes, so no diff byte and no confidence claim is re-typed by a model on its way to the user.

## Validation and ownership records

The job must call `patch_artifacts.py --validate-report` before consuming report data and `--prepare-run` before creating a scratch workspace. The validator canonicalizes and binds the report directory, scan root, repository root, current full HEAD, scan prefix, rendered revision stamp, JSONL hash, verified finding counts, and every finding path used for selection or staleness checks. It rejects absolute/drive paths, backslashes, empty/`.`/`..` segments, `.git` segments, symlink traversal and special-file leaves.

`--prepare-run` uses exclusive directory creation and a 128-bit random nonce. It creates:

- `<report>/.crabcode-security-run/patch-<UTC YYYYMMDD-HHMMSS>-<32 lowercase hex>/.crabcode-security-patch-owner.json`, binding the run nonce, exact selected ids and validated repository paths to the canonical report/root/base plus SHA-256 hashes of the revision stamp and JSONL;
- `<report>/patches/.crabcode-security-patches-owner.json`, binding persistent products to the same report/root/base and hashes.

An existing active run is a collision and is refused. An existing `patches/` folder is reusable only when its regular, non-symlink owner marker exactly matches the current validated report identity. These records establish internal association, not cryptographic authorship: a hostile same-account writer still requires OS-level isolation.

## The working record — `patches.json`

Written by the Security Lead into the machine-returned patch working ground (`<report dir>/.crabcode-security-run/patch-<ts>-<nonce>/patches.json`). One object with a `units` array, one entry per selected finding, in exactly the selected order:

```json
{
  "units": [
    {
      "id": "F1",
      "title": "SQL injection in report export query",
      "status": "patch_written",
      "summary": "The export endpoint interpolated the user-supplied table name into SQL; the patch binds it against the allowlist of exportable tables instead.",
      "claims": {
        "targeted": { "state": "CONFIDENT", "evidence": "one hunk, export.py:88-94, only the query construction moved" },
        "no_new_vulnerability": { "state": "CONFIDENT", "evidence": "the allowlist is the existing EXPORT_TABLES constant; no new input reaches SQL" },
        "behaviour_unchanged": { "state": "CONFIDENT", "evidence": "tests/test_export.py covers all three exportable tables and passes" }
      },
      "untested": false,
      "tests_run": "python -m pytest tests/ -q (41 passed)",
      "reviewed_paths": ["M src/export.py"]
    },
    {
      "id": "F3",
      "title": "Path traversal in attachment download",
      "status": "declined",
      "claims": {
        "behaviour_unchanged": { "state": "UNSURE", "evidence": "no test covers the download handler and three callers pass paths I could not trace" }
      },
      "decline_reason": "I couldn't establish that the fix leaves existing download behaviour unchanged, so no patch was written.",
      "recommendation": "Resolve the requested path against the attachments root and reject anything outside it before opening the file."
    }
  ]
}
```

Fields, per unit:

| field             | when                                  | meaning                                                                 |
| ----------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| `id`              | always                                | the finding id, `^F[0-9]{1,9}$`; it must be one of the owner marker's exact selected ids |
| `title`           | always                                | the finding's title, quoted                                             |
| `status`          | always                                | `patch_written`, `declined`, or `skipped_stale`                         |
| `summary`         | `patch_written`                       | one line: root cause and what the change does                           |
| `claims`          | always (all three for `patch_written`) | `targeted`, `no_new_vulnerability`, `behaviour_unchanged`, each `{state, evidence}`; `state` is `CONFIDENT`, `NOT_CONFIDENT`, or `UNSURE` |
| `untested`        | `patch_written` (required, true/false)  | `true` when no test in the project's own suite exercises the patched code (a verifier's ad-hoc harness does not count) |
| `tests_run`       | `patch_written`                       | the verifier's verbatim test commands, or "none possible: …"            |
| `reviewed_paths`  | `patch_written`                       | the verifier's `REVIEWED_PATHS` (name-status form)                      |
| `decline_reason`  | `declined` / `skipped_stale`          | why no patch was written, in a sentence the user can read               |
| `recommendation`  | `declined` (optional)                 | the report's original fix recommendation, so the user still has it     |

A rejected attempt is not kept — neither its working tree nor its raw diff survives the run, because it was rejected; the declined note carries the blocking claim and the attempt's diffstat instead. There is no field naming a scratch directory or a saved diff, since the whole working ground is removed once the products are written.

`title`, `summary`, `tests_run`, and each claim's `evidence` are one-line fields: they are written into the patch's `#` comment header, so an embedded line break in any of them is folded to a space. Longer explanation belongs in the note fields, which are markdown body, not header lines.

The script refuses the record (exit 1, a message naming the field) when its units do not exactly equal the owner marker's selection, a unit id is malformed, a status is unknown, a `patch_written` unit lacks a claim, has any claim not `CONFIDENT`, or omits `untested`, a declined unit has no reason, or a required regular `F<n>.diff` is missing or malformed. Patches are byte-faithful: the diff Git wrote reaches `F<n>.patch` unchanged, CRLF and non-UTF-8 file content included. Before any product write or deletion, every unit and existing owned product is preflighted. Git parses each diff with `apply --numstat -z`; raw headers and parsed paths must be canonical and contained, and the actual normalized path set must exactly equal `reviewed_paths`. The script refuses a different current HEAD, changed report/stamp/results hash, owner mismatch, symlink/special-file input or output collision, unexpected cleanup entry, or any directory outside the exact marker-bound hierarchy. A refusal is corrected at its source or replaced with a fresh scan/run — never worked around by recreating a marker.

## The products — `<report dir>/patches/`

| file             | content                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------- |
| `F<n>.patch`     | the raw diff git wrote (`F<n>.diff`), with a `#`-comment header above the first `diff --git` line naming the finding, the trust label -- verified by a panel of agents (the independent verifier plus the fresh reviewer of the bare diff) -- the three claims and their evidence, the coverage notice when `untested` is true, and the one-line apply command. `git apply` ignores the header. |
| `F<n>.md`        | the note beside each unit: for a written patch, the same panel-of-agents trust label, the summary, claims, diffstat (a rename shown as `old => new`, a file's permission change named beside its path), tests run, the `git apply --check` outcome, and how to apply it -- the report path in that command shell-quoted, so a space in a parent directory's name keeps the command pasteable; for a declined unit, the blocking claim, the reason, the rejected attempt's diffstat (when the verifier reviewed a diff), and the original recommendation. |
| `PATCHES.md`     | the one-page index: patches written (each noted as verified by a panel of agents, with the coverage caveat flagged when `untested` is true), units with no patch and why, and the apply instructions. The trust label the user reads is always the panel's verification -- never a "tested"/"untested" label. |
| `patches.jsonl`  | one record per unit: `id`, `status`, `base` (the revision every patch applies to), `patch`, `note`, `claims`, `untested`, `tests_run`, `reviewed_paths`, `diffstat`, `apply_check`, `decline_reason`. |
| `.crabcode-security-patches-owner.json` | hidden machine ownership record tying this folder to the canonical report, repository, base, revision stamp hash, and results hash; never edit or synthesize it |

On every run the script also removes any regular, owner-contained `F<n>.patch` / `F<n>.md` an earlier run left in the folder that it did not write this time, so the folder always matches its index (a finding that earned a patch before and is declined now never keeps a stale, unlisted patch); other files in the folder are never touched. The scan-created report `.gitignore` must already be the exact regular `*\n` marker — a patch run never manufactures report ownership retroactively. Every written patch is checked read-only against the canonical repository with `git apply --check --`; a conflict is recorded, never hidden. Finally the script removes marker-bound `scratch-F<n>` workspaces, then only the allowlisted regular owner/record/diff files in the nonce-bearing patch directory, and removes the run directory only after rechecking its exact marker. Symlinks, special files, unexpected entries, changed report hashes, or ownership mismatches cause refusal/warning and remain in place. The patches owner marker remains with the product files.

There is an unavoidable residual same-user TOCTOU window between portable Python 3.9 path checks and filesystem operations. Atomic exclusive creation, no-follow final opens, canonical containment and immediate destructive rechecks narrow that window; they do not replace an OS sandbox when another concurrent writer is hostile.
