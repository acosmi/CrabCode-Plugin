import { promises as fs } from 'node:fs';
import { extname, resolve } from 'node:path';
import { ERROR_CODES, OfficeSuiteError } from './errors.ts';

export type SupportedFormat = 'xlsx' | 'csv' | 'tsv' | 'docx' | 'pptx' | 'pdf';

const EXTENSION_TO_FORMAT: Record<string, SupportedFormat> = {
  '.xlsx': 'xlsx',
  '.xlsm': 'xlsx',
  '.csv': 'csv',
  '.tsv': 'tsv',
  '.docx': 'docx',
  '.pptx': 'pptx',
  '.pdf': 'pdf',
};

export function detectFormat(path: string): SupportedFormat {
  const ext = extname(path).toLowerCase();
  const format = EXTENSION_TO_FORMAT[ext];
  if (!format) {
    throw new OfficeSuiteError(
      ERROR_CODES.UNSUPPORTED_FORMAT,
      `Unsupported file extension: ${ext || '(none)'} for path ${path}`,
    );
  }
  return format;
}

export async function readBytes(path: string): Promise<Uint8Array> {
  const absolute = resolve(path);
  try {
    return await fs.readFile(absolute);
  } catch (cause) {
    throw new OfficeSuiteError(
      ERROR_CODES.IO_FAILURE,
      `Failed to read ${absolute}`,
      cause,
    );
  }
}

export async function writeBytes(path: string, data: Uint8Array): Promise<void> {
  const absolute = resolve(path);
  try {
    await fs.writeFile(absolute, data);
  } catch (cause) {
    throw new OfficeSuiteError(
      ERROR_CODES.IO_FAILURE,
      `Failed to write ${absolute}`,
      cause,
    );
  }
}
