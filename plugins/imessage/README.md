# iMessage

CrabCode integration with iMessage on macOS as a messaging bridge. The
bridge reads `~/Library/Messages/chat.db` directly and sends via AppleScript.

> Window B (this plugin) provides only the wrapper scaffold. The TypeScript
> bridge server (`src/`) and the access-control skills are produced by the
> runtime migration window.

## macOS permissions

The bridge needs the following grants on the host that runs CrabCode:

- **Full Disk Access** — required to read `~/Library/Messages/chat.db`.
  Grant this to the terminal (or IDE) that launches CrabCode under System
  Settings → Privacy & Security → Full Disk Access.
- **Automation / Apple Events** — required so the bridge can drive Messages
  via AppleScript. macOS prompts for this on first send.

The bridge will not function until both grants are in place.

## Connect

`.mcp.json` invokes `bun run --cwd ${CRABCODE_PLUGIN_ROOT} --shell=bun
--silent start`. The runtime migration window supplies the `start` script
in `package.json`.

## Access control

Default policy is `allowlist`. Pairing on iMessage is risky because the Mac
sees every contact who texts you; the runtime window's access skill is the
only safe way to mutate policy. Self-chat always bypasses the gate.

## Notes

This wrapper documents the plugin shape and pins the launcher contract.
Refer to the bridge's own documentation for the full setup flow once the
runtime ships.
