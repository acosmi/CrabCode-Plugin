# Repository Instructions

## Merge policy (mandatory)

- Agents and automated assistants must never merge pull requests or branches for this repository. This includes `git merge`, merge commits, squash-and-merge, rebase-and-merge, merge API calls, and enabling auto-merge.
- Do not commit directly to `main`. Create a dedicated working branch for every change.
- Agents may edit, test, commit, and push a working branch, and may open or update a pull request when requested.
- Stop after handing off the branch or pull request. Only a repository administrator may perform the final merge into `main`.
- Do not weaken, bypass, or remove the branch protection or ruleset that enforces this policy.
