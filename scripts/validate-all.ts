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
  formatCrabLawRegistryIssues,
  validateCrabLawRegistry,
} from "../src/policy/crabLawRegistryValidator.ts";
import {
  formatReferenceIssues,
  validateReferences,
} from "../src/policy/referenceValidator.ts";
import {
  formatMcpContractIssues,
  validateMcpContract,
} from "../src/policy/mcpContractValidator.ts";
import {
  formatPresentationIssues,
  validatePresentation,
} from "../src/policy/presentationValidator.ts";
import {
  formatVersionConsistencyIssues,
  validateVersionConsistency,
} from "../src/policy/versionConsistencyValidator.ts";
import { formatDocFactsIssues, validateDocFacts } from "../src/policy/docFactsValidator.ts";
import {
  formatWorkflowTriggerIssues,
  validateManualWorkflowTriggers,
} from "../src/policy/workflowTriggerValidator.ts";

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

const versions = await validateVersionConsistency(root);
if (versions.length > 0) {
  hasOutput = true;
  process.stderr.write(`[versions]\n${formatVersionConsistencyIssues(versions, root)}\n`);
  if (versions.some((issue) => issue.severity === "error")) hasError = true;
}

const presentation = await validatePresentation(root);
if (presentation.length > 0) {
  hasOutput = true;
  process.stderr.write(`[presentation]\n${formatPresentationIssues(presentation, root)}\n`);
  if (presentation.some((entry) => entry.severity === "error")) hasError = true;
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

const crabLawRegistry = await validateCrabLawRegistry(root);
if (crabLawRegistry.length > 0) {
  hasOutput = true;
  process.stderr.write(`[crablaw-registry]\n${formatCrabLawRegistryIssues(crabLawRegistry, root)}\n`);
  if (crabLawRegistry.some((issue) => issue.severity === "error")) hasError = true;
}

const references = await validateReferences(root);
if (references.length > 0) {
  hasOutput = true;
  process.stderr.write(`[refs]\n${formatReferenceIssues(references, root)}\n`);
  if (references.some((issue) => issue.severity === "error")) hasError = true;
}

const mcpContract = await validateMcpContract(root);
if (mcpContract.length > 0) {
  hasOutput = true;
  process.stderr.write(`[mcp-contract]\n${formatMcpContractIssues(mcpContract, root)}\n`);
  if (mcpContract.some((issue) => issue.severity === "error")) hasError = true;
}

const docFacts = await validateDocFacts(root);
if (docFacts.length > 0) {
  hasOutput = true;
  process.stderr.write(`[doc-facts]\n${formatDocFactsIssues(docFacts, root)}\n`);
  if (docFacts.some((issue) => issue.severity === "error")) hasError = true;
}

const workflowTriggers = await validateManualWorkflowTriggers(root);
if (workflowTriggers.length > 0) {
  hasOutput = true;
  process.stderr.write(`[workflow-triggers]\n${formatWorkflowTriggerIssues(workflowTriggers)}\n`);
  hasError = true;
}

if (!hasOutput) {
  process.stdout.write("validate-all: all checks passed\n");
}

if (hasError) {
  process.exitCode = 1;
}
