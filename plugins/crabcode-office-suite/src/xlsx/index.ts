import { ERROR_CODES, OfficeSuiteError } from '../common/errors.ts';
import { detectFormat, readBytes } from '../common/io.ts';

export interface SpreadsheetSummary {
  path: string;
  format: 'xlsx' | 'csv' | 'tsv';
  byteLength: number;
}

/**
 * Inspect a spreadsheet file and return a summary.
 *
 * Full read/write support requires an XLSX engine adapter (for example,
 * exceljs). The intent of this module is to define the public surface so a
 * future adapter implementation can drop in without disturbing the skill
 * prompts or downstream callers.
 */
export async function summarize(path: string): Promise<SpreadsheetSummary> {
  const format = detectFormat(path);
  if (format !== 'xlsx' && format !== 'csv' && format !== 'tsv') {
    throw new OfficeSuiteError(
      ERROR_CODES.UNSUPPORTED_FORMAT,
      `summarize() requires a spreadsheet format; got ${format} for ${path}`,
    );
  }
  const bytes = await readBytes(path);
  return { path, format, byteLength: bytes.byteLength };
}

/**
 * Recalculate formulas in an xlsx workbook.
 *
 * Implementations should delegate to an external engine such as LibreOffice
 * via a sandbox-safe wrapper. This placeholder reports the missing capability
 * so that callers can detect the gap during installation validation.
 */
export async function recalculate(path: string): Promise<never> {
  throw new OfficeSuiteError(
    ERROR_CODES.NOT_IMPLEMENTED,
    `recalculate() is not yet implemented for ${path}. Install an engine adapter and wire it into src/xlsx.`,
  );
}
