import { ERROR_CODES, OfficeSuiteError } from '../common/errors.ts';
import { detectFormat, readBytes } from '../common/io.ts';

export interface DocumentSummary {
  path: string;
  format: 'docx';
  byteLength: number;
}

export async function summarize(path: string): Promise<DocumentSummary> {
  const format = detectFormat(path);
  if (format !== 'docx') {
    throw new OfficeSuiteError(
      ERROR_CODES.UNSUPPORTED_FORMAT,
      `summarize() requires a docx file; got ${format} for ${path}`,
    );
  }
  const bytes = await readBytes(path);
  return { path, format, byteLength: bytes.byteLength };
}

/**
 * Apply a series of structural or stylistic edits to a docx file.
 *
 * Implementations should use the docx library and jszip to unpack, mutate,
 * and repack the OOXML payload. The placeholder body documents the gap so
 * environment validators can detect missing adapters.
 */
export async function applyEdits(path: string, _operations: ReadonlyArray<unknown>): Promise<never> {
  throw new OfficeSuiteError(
    ERROR_CODES.NOT_IMPLEMENTED,
    `applyEdits() is not yet implemented for ${path}. Wire a docx editor adapter into src/docx.`,
  );
}
