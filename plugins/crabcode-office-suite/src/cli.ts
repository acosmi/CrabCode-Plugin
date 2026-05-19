import { OfficeSuiteError } from './common/errors.ts';
import { createLogger } from './common/logger.ts';
import * as xlsx from './xlsx/index.ts';
import * as docx from './docx/index.ts';
import * as pptx from './pptx/index.ts';
import * as pdf from './pdf/index.ts';

const logger = createLogger({ level: (process.env.CRABCODE_OFFICE_LOG_LEVEL as 'info' | undefined) ?? 'info' });

interface CliArgs {
  module: 'xlsx' | 'docx' | 'pptx' | 'pdf';
  action: 'summarize';
  path: string;
}

const HELP = `crabcode-office <module> <action> <path>

modules: xlsx | docx | pptx | pdf
actions:
  summarize <path>   Report basic file metadata for the input.

This entry point is intentionally narrow. Domain workflows are delegated to
per-module adapters once those adapters land.`;

function parseArgs(argv: ReadonlyArray<string>): CliArgs {
  if (argv.length < 3) {
    throw new OfficeSuiteError('INVALID_INPUT', 'Expected: <module> <action> <path>');
  }
  const [moduleName, action, path] = argv;
  const allowedModules = new Set(['xlsx', 'docx', 'pptx', 'pdf']);
  if (!moduleName || !allowedModules.has(moduleName)) {
    throw new OfficeSuiteError('INVALID_INPUT', `Unknown module: ${moduleName ?? '(missing)'}`);
  }
  if (action !== 'summarize') {
    throw new OfficeSuiteError('INVALID_INPUT', `Unknown action: ${action ?? '(missing)'}`);
  }
  if (!path) {
    throw new OfficeSuiteError('INVALID_INPUT', 'Path argument is required');
  }
  return {
    module: moduleName as CliArgs['module'],
    action: 'summarize',
    path,
  };
}

async function dispatch(args: CliArgs): Promise<unknown> {
  switch (args.module) {
    case 'xlsx':
      return await xlsx.summarize(args.path);
    case 'docx':
      return await docx.summarize(args.path);
    case 'pptx':
      return await pptx.summarize(args.path);
    case 'pdf':
      return await pdf.summarize(args.path);
  }
}

export async function main(argv: ReadonlyArray<string>): Promise<number> {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    process.stdout.write(HELP + '\n');
    return 0;
  }
  try {
    const args = parseArgs(argv);
    const result = await dispatch(args);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return 0;
  } catch (err) {
    if (err instanceof OfficeSuiteError) {
      logger.error(err.message, { code: err.code });
      return 2;
    }
    logger.error('Unexpected failure', { error: err instanceof Error ? err.message : String(err) });
    return 1;
  }
}

if (import.meta.main) {
  const code = await main(process.argv.slice(2));
  process.exit(code);
}
