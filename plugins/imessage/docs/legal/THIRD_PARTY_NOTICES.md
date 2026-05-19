# Third-Party Notices

This CrabCode plugin packages a macOS iMessage bridge as a CrabCode
integration.

## Vendor

- Name: Apple Inc. (host platform)
- Bridge transport: macOS Messages (`chat.db` reads, AppleScript sends)

## Migration

- Migration date: 2026-05-19
- Source: cached upstream marketplace tree under `bangong/` (excluded from
  version control via `.gitignore`).
- Upstream cache commit: `4bf08583c37e04f764806ea7a96ca74fb80ced1d`.
- Wrapper scope: this directory contains only the manifest, `.mcp.json`,
  README, and this notice. The TypeScript bridge server and access-control
  skills are added by the runtime migration window.

## Licensing

- CrabCode plugin wrapper: MIT, CrabCode.
- iMessage and macOS are licensed by Apple; users are responsible for
  ensuring their use of the bridge complies with Apple's end-user terms.
