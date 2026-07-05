import {
  formatBrandViolations,
  formatStaleAllowlistEntries,
  scanPathDetailed,
} from "../src/policy/brandGuard.ts";

const target = process.argv[2] ?? ".";
const { violations, staleAllowlistEntries } = await scanPathDetailed(target);

if (staleAllowlistEntries.length > 0) {
  process.stderr.write(`${formatStaleAllowlistEntries(staleAllowlistEntries)}\n`);
}
if (violations.length > 0) {
  process.stderr.write(`${formatBrandViolations(violations)}\n`);
  process.exitCode = 1;
}
