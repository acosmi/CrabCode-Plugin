import { formatBrandViolations, scanPath } from "../src/policy/brandGuard.ts";

const target = process.argv[2] ?? ".";
const violations = await scanPath(target);

if (violations.length > 0) {
  process.stderr.write(`${formatBrandViolations(violations)}\n`);
  process.exitCode = 1;
}

