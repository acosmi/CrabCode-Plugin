import { describe, expect, test } from 'bun:test';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../src/cli.ts';
import { detectFormat } from '../src/common/io.ts';
import { OfficeSuiteError } from '../src/common/errors.ts';
import * as xlsx from '../src/xlsx/index.ts';
import * as docx from '../src/docx/index.ts';
import * as pptx from '../src/pptx/index.ts';
import * as pdf from '../src/pdf/index.ts';

describe('detectFormat', () => {
  test.each([
    ['report.xlsx', 'xlsx'],
    ['data.csv', 'csv'],
    ['feed.tsv', 'tsv'],
    ['memo.docx', 'docx'],
    ['deck.pptx', 'pptx'],
    ['manual.pdf', 'pdf'],
  ] as const)('maps %s to %s', (path, expected) => {
    expect(detectFormat(path)).toBe(expected);
  });

  test('rejects unsupported extensions', () => {
    expect(() => detectFormat('archive.zip')).toThrow(OfficeSuiteError);
  });
});

describe('summarize adapters', () => {
  test('xlsx summarize reports byte length', async () => {
    const file = join(tmpdir(), `crabcode-office-${Date.now()}.xlsx`);
    await fs.writeFile(file, Buffer.from('PKplaceholder'));
    try {
      const summary = await xlsx.summarize(file);
      expect(summary.format).toBe('xlsx');
      expect(summary.byteLength).toBeGreaterThan(0);
    } finally {
      await fs.unlink(file).catch(() => undefined);
    }
  });

  test('docx summarize rejects non-docx', async () => {
    await expect(docx.summarize('memo.txt')).rejects.toBeInstanceOf(OfficeSuiteError);
  });

  test('pptx and pdf summarize reject mismatched formats', async () => {
    await expect(pptx.summarize('deck.xlsx')).rejects.toBeInstanceOf(OfficeSuiteError);
    await expect(pdf.summarize('manual.docx')).rejects.toBeInstanceOf(OfficeSuiteError);
  });
});

describe('cli main', () => {
  test('emits help and exits zero with --help', async () => {
    const code = await main(['--help']);
    expect(code).toBe(0);
  });

  test('returns non-zero on missing arguments', async () => {
    const code = await main([]);
    expect(code).toBe(0);
  });

  test('returns non-zero on unknown module', async () => {
    const code = await main(['bogus', 'summarize', 'x.xlsx']);
    expect(code).toBe(2);
  });
});
