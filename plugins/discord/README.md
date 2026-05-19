# Discord

CrabCode integration with Discord as a messaging bridge. The bridge accepts
inbound messages from approved senders and relays outbound responses from
CrabCode.

> Window B (this plugin) provides only the wrapper scaffold. The TypeScript
> bridge server (`src/`) and the access-control skills (`skills/access`,
> `skills/configure`) are produced by the runtime migration window.

## Connect

`.mcp.json` invokes `bun run --cwd ${CRABCODE_PLUGIN_ROOT} --shell=bun
--silent start`. The runtime migration window supplies the `start` script
in `package.json`.

## Access control

The bridge uses pairing or an allowlist to determine who may reach you. All
access mutations happen through the bridge's `access` skill running in your
terminal, never through an inbound message.

## Notes

This wrapper documents the plugin shape and pins the launcher contract.
Refer to the bridge's own documentation for token setup, pairing flow, and
policy choices once the runtime ships.
