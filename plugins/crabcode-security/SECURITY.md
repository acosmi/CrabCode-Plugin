# Security policy

This plugin is a security tool, so it is held to the standard it applies to other people's code. If you find a vulnerability in the plugin itself, report it.

## Reporting a vulnerability

Report security issues **privately** with a [GitHub Security Advisory](https://github.com/acosmi/CrabCode-Plugin/security/advisories/new). If that private channel is unavailable, contact the repository maintainers through an established private support channel before disclosing details.

Do **not** open a public GitHub issue for a security report. Include what you can of: the plugin version from `.crabcode-plugin/plugin.json`, your platform and CrabCode version, reproduction steps, and the impact you believe it has.

In scope: a vulnerability in the plugin's own code — its scripts, workflow, skills, agent definitions, and hooks.

Out of scope: findings the scan produces about *your* code (best-effort by design, so a missed vulnerability there is a quality issue, not a plugin vulnerability); the behavior of CrabCode models themselves, such as jailbreaks or harmful content (the channel above routes those too); and anything downstream of a hostile repository, per the trust model below.

## Trust model

**The code you scan is trusted.** A scan and a fix run in your CrabCode session, under your permissions, with no isolation layer of the plugin's own — so the repository's `.git/config`, its `.crabcode/` settings and hooks, and everything else your session loads from that directory apply as usual. The plugin does not attempt to stop a hostile repository from influencing a scan.

This prerelease supports trusted repositories only. An OS-level sandbox or disposable virtual machine can restrict filesystem, process, and network access, but it does not neutralize repository instructions, hooks, MCP configuration, or other project context already loaded by CrabCode. Untrusted-repository support therefore requires both OS isolation and a clean profile that disables repository configuration; this plugin does not provide either boundary.

Reports remain local, and the plugin adds no separate telemetry or upload endpoint. Agent inference still uses the model provider configured for CrabCode and can transmit prompts and selected code context under CrabCode's and that provider's data contract.

## Supported versions

Security fixes land on the latest released version of the plugin. There are no long-lived support branches. Update to the newest version before reporting.
