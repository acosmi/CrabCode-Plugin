import { ERROR_CODES, OfficeSuiteError } from '../common/errors.ts';
import { detectFormat, readBytes } from '../common/io.ts';

export interface PdfSummary {
  path: string;
  format: 'pdf';
  byteLength: number;
}

export async function summarize(path: string): Promise<PdfSummary> {
  const format = detectFormat(path);
  if (format !== 'pdf') {
    throw new OfficeSuiteError(
      ERROR_CODES.UNSUPPORTED_FORMAT,
      `summarize() requires a pdf file; got ${format} for ${path}`,
    );
  }
  const bytes = await readBytes(path);
  return { path, format, byteLength: bytes.byteLength };
}

/**
 * Merge a list of pdf files in order to produce a single output document.
 *
 * Implementations should rely on pdf-lib for native edits and may shell out
 * to qpdf for fixups. The placeholder reports the missing capability so the
 * surface stays stable while adapters land.
 */
export async function merge(_inputs: ReadonlyArray<string>, outputPath: string): Promise<never> {
  throw new OfficeSuiteError(
    ERROR_CODES.NOT_IMPLEMENTED,
    `merge() is not yet implemented (target ${outputPath}). Wire a pdf engine adapter into src/pdf.`,
  );
}
