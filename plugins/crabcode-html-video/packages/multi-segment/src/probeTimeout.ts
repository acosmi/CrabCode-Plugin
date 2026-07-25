/**
 * Wall-clock cap for a `-version` / `--version` probe of an external binary.
 *
 * What these probes actually spawn is ffmpeg-static's 77MB static binary and
 * chrome-headless-shell, whose slow case is a cold page-cache load. Neither of
 * the two values this replaces (5000ms in ffmpeg resolution, 10_000ms in the
 * browser probe) came from a measured distribution.
 *
 * The cap is set from the worst case we are willing to wait rather than from a
 * typical one, because failing a probe here is silent: ffmpeg resolution falls
 * through to an unpinned system binary, and the media tests turn themselves off.
 * A budget smaller than the thing it guards is the same defect that turned this
 * plugin's CI job red on 2026-07-24.
 *
 * The cost of the choice is that a genuinely hung probe blocks for 20s instead
 * of 5s or 10s. That is accepted: a hung probe means a broken installation
 * either way, while the failure mode it replaces — a slow but working binary
 * being declared missing — is invisible and far harder to diagnose.
 */
export const EXTERNAL_BINARY_PROBE_TIMEOUT_MS = 20_000
