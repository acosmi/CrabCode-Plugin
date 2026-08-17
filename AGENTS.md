# Repository Instructions

## Automated delivery and merge policy (mandatory)

- Agents and automated assistants must never merge pull requests or branches for this repository. This includes `git merge`, merge commits, squash-and-merge, rebase-and-merge, merge API calls, and enabling auto-merge.
- For every task that changes tracked files, including continued, scheduled, or recurring automation, automatically create or reuse a dedicated working branch. Do not wait for a separate request, and never commit directly to `main`.
- After making the change and running the relevant checks, commit only the intended files, push the working branch, and automatically create or update a pull request targeting `main`.
- Open completed and validated work as ready for administrator review. If the work is incomplete or validation is failing, keep the pull request in draft and clearly state what remains.
- Reuse the existing task branch and pull request for follow-up automation instead of creating duplicates.
- Stop after handing off the pull request. Only a repository administrator may perform the final merge into `main`.
- Do not weaken, bypass, or remove the branch protection or ruleset that enforces this policy.
