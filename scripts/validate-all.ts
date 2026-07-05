import path from "node:path";
import {
  formatBrandViolations,
  formatStaleAllowlistEntries,
  scanPathDetailed,
} from "../src/policy/brandGuard.ts";
import {
  formatManifestIssues,
  validateManifests,
} from "../src/policy/manifestValidator.ts";
import {
  formatMarketplaceIssues,
  validateMarketplace,
} from "../src/policy/marketplaceValidator.ts";
import { formatLayoutIssues, validateLayout } from "../src/policy/layoutValidator.ts";
import {
  formatMatterGateIssues,
  validateMatterGate,
} from "../src/policy/matterGateValidator.ts";
import {
  formatReferenceIssues,
  validateReferences,
} from "../src/policy/referenceValidator.ts";

const root = path.resolve(process.argv[2] ?? ".");

let hasError = false;
let hasOutput = false;

const brand = await scanPathDetailed(root);
if (brand.staleAllowlistEntries.length > 0) {
  hasOutput = true;
  process.stderr.write(`[brand]\n${formatStaleAllowlistEntries(brand.staleAllowlistEntries)}\n`);
}
if (brand.violations.length > 0) {
  hasOutput = true;
  process.stderr.write(`[brand]\n${formatBrandViolations(brand.violations)}\n`);
  hasError = true;
}

const manifest = await validateManifests(root);
if (manifest.length > 0) {
  hasOutput = true;
  process.stderr.write(`[manifest]\n${formatManifestIssues(manifest, root)}\n`);
  if (manifest.some((issue) => issue.severity === "error")) hasError = true;
}

const marketplace = await validateMarketplace(root);
if (marketplace.length > 0) {
  hasOutput = true;
  process.stderr.write(`[marketplace]\n${formatMarketplaceIssues(marketplace, root)}\n`);
  if (marketplace.some((issue) => issue.severity === "error")) hasError = true;
}

const layout = await validateLayout(root);
if (layout.length > 0) {
  hasOutput = true;
  process.stderr.write(`[layout]\n${formatLayoutIssues(layout, root)}\n`);
  if (layout.some((issue) => issue.severity === "error")) hasError = true;
}

const matterGate = await validateMatterGate(root);
if (matterGate.length > 0) {
  hasOutput = true;
  process.stderr.write(`[tool-scope]\n${formatMatterGateIssues(matterGate, root)}\n`);
  if (matterGate.some((issue) => issue.severity === "error")) hasError = true;
}

const references = await validateReferences(root);
if (references.length > 0) {
  hasOutput = true;
  process.stderr.write(`[refs]\n${formatReferenceIssues(references, root)}\n`);
  if (references.some((issue) => issue.severity === "error")) hasError = true;
}

if (!hasOutput) {
  process.stdout.write("validate-all: all checks passed\n");
}

if (hasError) {
  process.exitCode = 1;
}
