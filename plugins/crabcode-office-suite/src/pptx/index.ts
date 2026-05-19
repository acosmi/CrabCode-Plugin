import { ERROR_CODES, OfficeSuiteError } from '../common/errors.ts';
import { detectFormat, readBytes } from '../common/io.ts';

export interface PresentationSummary {
  path: string;
  format: 'pptx';
  byteLength: number;
}

export async function summarize(path: string): Promise<PresentationSummary> {
  const format = detectFormat(path);
  if (format !== 'pptx') {
    throw new OfficeSuiteError(
      ERROR_CODES.UNSUPPORTED_FORMAT,
      `summarize() requires a pptx file; got ${format} for ${path}`,
    );
  }
  const bytes = await readBytes(path);
  return { path, format, byteLength: bytes.byteLength };
}

/**
 * Build a pptx file from a structured slide deck description.
 *
 * Implementations should rely on pptxgenjs for primary authoring and jszip
 * for low-level OOXML adjustments. The placeholder reports the missing
 * capability so the surface stays stable while adapters land.
 */
export async function build(_descriptor: unknown, outputPath: string): Promise<never> {
  throw new OfficeSuiteError(
    ERROR_CODES.NOT_IMPLEMENTED,
    `build() is not yet implemented (target ${outputPath}). Wire a pptx authoring adapter into src/pptx.`,
  );
}
